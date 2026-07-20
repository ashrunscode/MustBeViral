'use client';

import { Button, Chip, MonoCaps } from '@mustbeviral/ui';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import {
  GOLDEN_NODE_WIDTH,
  InMemoryCanvasPort,
  isSimplifiedCanvasLod,
  mapCanvasNodesToOutline,
  mapCanvasStatusToChip,
  type CanvasEdge,
  type CanvasModel,
  type CanvasNode,
  type CanvasPortResult,
  type CanvasPortScenario,
} from '../../../../../src/features/canvas/canvas-port';
import styles from './canvas-flow.module.css';

const NODE_HEIGHT = 94;
const VIRTUALIZATION_MARGIN = 240;

function edgePath(edge: CanvasEdge, nodes: ReadonlyMap<string, CanvasNode>): string {
  const source = nodes.get(edge.source_node_id);
  const target = nodes.get(edge.target_node_id);
  if (source === undefined || target === undefined) return '';
  const startX = source.x + GOLDEN_NODE_WIDTH;
  const startY = source.y + NODE_HEIGHT / 2;
  const endX = target.x;
  const endY = target.y + NODE_HEIGHT / 2;
  const control = Math.max(16, Math.abs(endX - startX) / 2);
  return `M${String(startX)} ${String(startY)} C${String(startX + control)} ${String(startY)} ${String(endX - control)} ${String(endY)} ${String(endX)} ${String(endY)}`;
}

function lineageFor(model: CanvasModel, selectedId: string): ReadonlySet<string> {
  const related = new Set([selectedId]);
  const ancestors = [selectedId];
  const descendants = [selectedId];
  while (ancestors.length > 0) {
    const nodeId = ancestors.shift();
    if (nodeId === undefined) break;
    for (const edge of model.edges) {
      if (edge.target_node_id === nodeId && !related.has(edge.source_node_id)) {
        related.add(edge.source_node_id);
        ancestors.push(edge.source_node_id);
      }
    }
  }
  while (descendants.length > 0) {
    const nodeId = descendants.shift();
    if (nodeId === undefined) break;
    for (const edge of model.edges) {
      if (edge.source_node_id === nodeId && !related.has(edge.target_node_id)) {
        related.add(edge.target_node_id);
        descendants.push(edge.target_node_id);
      }
    }
  }
  return related;
}

export function CanvasResultBanner({
  result,
  onReload,
}: Readonly<{ result: CanvasPortResult | null; onReload?: () => void }>) {
  if (result === null) return null;
  if (result.type === 'ok') {
    return (
      <div
        className={`${styles.resultBanner} ${styles.resultSuccess}`}
        role="status"
        data-result="ok"
      >
        <span aria-hidden="true">✓</span> Revision {result.model.revision} is valid and ready to
        quote.
      </div>
    );
  }
  if (result.type === 'conflict') {
    return (
      <div
        className={`${styles.resultBanner} ${styles.resultConflict}`}
        role="alert"
        data-result="conflict"
      >
        <span>
          Expected revision {result.expected_revision_id}, but {result.actual_revision_id} is now
          current.
        </span>
        <Button variant="ghost" onClick={onReload}>
          Reload latest revision
        </Button>
      </div>
    );
  }
  return (
    <div
      className={`${styles.resultBanner} ${styles.resultInvalid}`}
      role="alert"
      data-result="graph_invalid"
    >
      <strong>Graph invalid</strong>
      <span>{result.issues[0]?.message ?? 'Repair the graph before requesting a quote.'}</span>
    </div>
  );
}

function NodeCard({
  arrival,
  dimmed,
  node,
  selected,
  simplified,
  onSelect,
}: Readonly<{
  arrival: boolean;
  dimmed: boolean;
  node: CanvasNode;
  selected: boolean;
  simplified: boolean;
  onSelect: () => void;
}>) {
  const chip = mapCanvasStatusToChip(node.status);
  return (
    <button
      type="button"
      className={`${styles.nodeCard} ${selected ? 'node-selected' : ''} ${dimmed ? 'node-dim' : ''} ${arrival ? 'arrival-warm' : ''} ${simplified ? styles.nodeSimplified : ''}`}
      style={{ left: node.x, top: node.y }}
      data-node-id={node.id}
      data-node-status={node.status}
      aria-pressed={selected}
      aria-label={`${node.kindLabel}: ${node.label}, ${chip.label}`}
      onClick={onSelect}
    >
      {node.status === 'running' ? <span className="filament-sweep" aria-hidden="true" /> : null}
      <span className={styles.nodeTopline}>
        <MonoCaps>{node.kindLabel}</MonoCaps>
        <Chip status={chip.status}>{chip.label}</Chip>
      </span>
      <span className={styles.nodeTitle}>{node.label}</span>
      <span className={styles.nodeEvidence}>
        <MonoCaps>{node.model}</MonoCaps>
        <MonoCaps>{node.statusDetail}</MonoCaps>
      </span>
      {node.invalidReason === undefined || simplified ? null : (
        <span className={styles.invalidReason}>{node.invalidReason}</span>
      )}
    </button>
  );
}

export function CanvasFlow({
  fixtureNodeCount = 12,
  scenario = 'ok',
  workspace,
}: Readonly<{
  fixtureNodeCount?: 12 | 100;
  scenario?: CanvasPortScenario;
  workspace: string;
}>) {
  const [port] = useState(() => new InMemoryCanvasPort({ nodeCount: fixtureNodeCount, scenario }));
  const [model, setModel] = useState(() => port.read());
  const [selectedId, setSelectedId] = useState('2');
  const [result, setResult] = useState<CanvasPortResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 1120, height: 620 });
  const [arrivalNodeId, setArrivalNodeId] = useState<string | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{
    id: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const outlineRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const element = surfaceRef.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let settleTimer: number | undefined;
    const arrivalTimer = window.setTimeout(() => {
      setArrivalNodeId('6');
      settleTimer = window.setTimeout(() => setArrivalNodeId(null), 180);
    }, 2000);
    return () => {
      window.clearTimeout(arrivalTimer);
      if (settleTimer !== undefined) window.clearTimeout(settleTimer);
    };
  }, []);

  const nodesById = useMemo(
    () => new Map(model.nodes.map((node) => [node.id, node])),
    [model.nodes],
  );
  const outline = useMemo(() => mapCanvasNodesToOutline(model.nodes), [model.nodes]);
  const lineage = useMemo(() => lineageFor(model, selectedId), [model, selectedId]);
  const simplified = isSimplifiedCanvasLod(zoom);
  const visibleNodes = useMemo(() => {
    const left = -pan.x / zoom - VIRTUALIZATION_MARGIN;
    const top = -pan.y / zoom - VIRTUALIZATION_MARGIN;
    const right = left + viewport.width / zoom + VIRTUALIZATION_MARGIN * 2;
    const bottom = top + viewport.height / zoom + VIRTUALIZATION_MARGIN * 2;
    return model.nodes.filter(
      (node) =>
        node.x + GOLDEN_NODE_WIDTH >= left &&
        node.x <= right &&
        node.y + NODE_HEIGHT >= top &&
        node.y <= bottom,
    );
  }, [model.nodes, pan.x, pan.y, viewport.height, viewport.width, zoom]);

  const setZoomClamped = (next: number) => setZoom(Math.min(1.4, Math.max(0.45, next)));

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('button, a')) return;
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (pointer === null || pointer.id !== event.pointerId) return;
    setPan({
      x: pointer.panX + event.clientX - pointer.x,
      y: pointer.panY + event.clientY - pointer.y,
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
  }

  async function validateCanvas() {
    setValidating(true);
    const nextResult = await port.validate(model.revision);
    setResult(nextResult);
    setValidating(false);
  }

  async function reloadLatest() {
    const next = await port.reloadLatest();
    setModel(next.model);
    setResult(next);
  }

  function handleOutlineKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (index + direction + outline.length) % outline.length;
    outlineRefs.current[nextIndex]?.focus();
  }

  return (
    <main id="main-content" className={styles.canvasPage}>
      <section className={styles.workspace} aria-label="ViralGraph canvas">
        <div className={styles.toolbar}>
          <div>
            <MonoCaps>Canvas revision {model.revision}</MonoCaps>
            <span className={styles.toolbarTitle}>Lumen Skin launch pack</span>
          </div>
          <div className={styles.toolbarActions}>
            <MonoCaps data-testid="virtualized-count">
              {visibleNodes.length} / {model.nodes.length} nodes mounted
            </MonoCaps>
            <Button aria-label="Zoom out" onClick={() => setZoomClamped(zoom - 0.1)}>
              −
            </Button>
            <MonoCaps>{Math.round(zoom * 100)}%</MonoCaps>
            <Button aria-label="Zoom in" onClick={() => setZoomClamped(zoom + 0.1)}>
              +
            </Button>
            <Button
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(1);
              }}
            >
              Fit
            </Button>
            <Button
              feedback={
                validating
                  ? 'loading'
                  : result?.type === 'ok'
                    ? 'success'
                    : result === null
                      ? 'default'
                      : 'error'
              }
              loadingLabel="Validating"
              onClick={() => void validateCanvas()}
            >
              Validate graph
            </Button>
          </div>
        </div>
        <CanvasResultBanner result={result} onReload={() => void reloadLatest()} />
        <div
          ref={surfaceRef}
          className={styles.canvasSurface}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className={styles.graphPlane}
            data-lod={simplified ? 'simplified' : 'full'}
            style={{
              width: model.width,
              height: model.height,
              transform: `translate3d(${String(pan.x)}px, ${String(pan.y)}px, 0) scale(${String(zoom)})`,
            }}
          >
            <svg
              className={styles.edgeLayer}
              width={model.width}
              height={model.height}
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="canvas-arrow-default"
                  markerWidth="5"
                  markerHeight="5"
                  refX="4"
                  refY="2.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0 0 L5 2.5 L0 5 Z" fill="rgba(0,0,0,0.25)" />
                </marker>
                <marker
                  id="canvas-arrow-transfer"
                  markerWidth="5"
                  markerHeight="5"
                  refX="4"
                  refY="2.5"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0 0 L5 2.5 L0 5 Z" fill="#3182d4" />
                </marker>
              </defs>
              {model.edges.map((edge) => (
                <path
                  key={edge.id}
                  data-edge={edge.id}
                  d={edgePath(edge, nodesById)}
                  className={`flow-line ${edge.state === 'active' ? 'flow-active' : ''} ${edge.state === 'transfer' ? 'flow-transfer' : ''}`}
                  markerEnd={
                    edge.state === 'transfer'
                      ? 'url(#canvas-arrow-transfer)'
                      : 'url(#canvas-arrow-default)'
                  }
                />
              ))}
            </svg>
            {visibleNodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                selected={selectedId === node.id}
                dimmed={!lineage.has(node.id)}
                simplified={simplified}
                arrival={arrivalNodeId === node.id}
                onSelect={() => setSelectedId(node.id)}
              />
            ))}
          </div>
        </div>
        <div className={styles.quoteBar}>
          <div>
            <MonoCaps>Pinned revision</MonoCaps>
            <MonoCaps>{model.revision}</MonoCaps>
          </div>
          <div>
            <MonoCaps>Route</MonoCaps>
            <MonoCaps>kimi-2.6 + flux-2-klein</MonoCaps>
          </div>
          <div>
            <MonoCaps>Quote basis</MonoCaps>
            <MonoCaps>$4.20 total run</MonoCaps>
          </div>
          <Link className="mbv-button mbv-button--primary" href={`/studio/${workspace}/quote`}>
            Review $4.20 quote
          </Link>
        </div>
      </section>
      <aside className={styles.outlinePanel} aria-labelledby="outline-title">
        <div className={styles.outlineHeader}>
          <div>
            <MonoCaps>Semantic parity</MonoCaps>
            <h2 id="outline-title">Graph outline</h2>
          </div>
          <Chip status="notes">{model.nodes.length} nodes</Chip>
        </div>
        <p className={styles.outlineHelp}>Topological order. Use ↑ and ↓ to move between nodes.</p>
        <ol className={styles.outlineList}>
          {outline.map((row, index) => {
            const chip = mapCanvasStatusToChip(row.status);
            return (
              <li key={row.id}>
                <button
                  ref={(element) => {
                    outlineRefs.current[index] = element;
                  }}
                  type="button"
                  className={styles.outlineRow}
                  data-outline-id={row.id}
                  data-outline-status={row.status}
                  aria-current={selectedId === row.id ? 'true' : undefined}
                  onClick={() => setSelectedId(row.id)}
                  onKeyDown={(event) => handleOutlineKeyDown(event, index)}
                >
                  <span>
                    <MonoCaps>{row.kindLabel}</MonoCaps>
                    <strong>{row.label}</strong>
                  </span>
                  <Chip status={chip.status}>{chip.label}</Chip>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
      <footer className={styles.footer}>
        <MonoCaps>Latency: 142ms · Node count: {model.nodes.length} · Region: us-east-1</MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
