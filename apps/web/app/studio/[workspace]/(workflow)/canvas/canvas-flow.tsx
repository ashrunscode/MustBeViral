'use client';

import { Button, Chip, MonoCaps } from '@mustbeviral/ui';
import Link from 'next/link';
import {
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  memo,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';

import {
  GOLDEN_NODE_WIDTH,
  InMemoryCanvasPort,
  WorkerCanvasMutationPort,
  WorkerCanvasReadPort,
  canvasQuotePresentation,
  createCanvasFixture,
  isSimplifiedCanvasLod,
  mapCanvasNodesToOutline,
  mapCanvasStatusToChip,
  type CanvasEdge,
  type CanvasFixtureNodeCount,
  type CanvasModel,
  type CanvasMutationPort,
  type CanvasNode,
  type CanvasOutlineRow,
  type CanvasReadPort,
  type CanvasReadResult,
  type CanvasPortResult,
  type CanvasPortScenario,
} from '../../../../../src/features/canvas/canvas-port';
import { SessionExpiredAction } from '../../../../../src/components/session-expired-action';
import { CollaborationSidebar } from '../../../../../src/features/collaboration/collaboration-panel';
import { NodeConfigDraftPanel } from '../../../../../src/features/collaboration/draft-panels';
import {
  collaborationActorForReviewer,
  commentsForAnchor,
  useCollaborationSession,
} from '../../../../../src/features/collaboration/use-collaboration-session';
import {
  checkpointCanvasDrafts,
  resolveCheckpointDrafts,
} from '../../../../../src/features/collaboration/checkpoint-canvas-drafts';
import { createBrowserCoreClient } from '../../../../../src/lib/core/browser-client';
import { createMutationIdempotencyKey } from '../../../../../src/lib/core/idempotency';
import styles from './canvas-flow.module.css';

const NODE_HEIGHT = 94;
const VIRTUALIZATION_MARGIN = 240;

const OutlineRow = memo(function OutlineRow({
  index,
  onNavigate,
  onRegister,
  onSelect,
  row,
  selected,
}: Readonly<{
  index: number;
  onNavigate: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onRegister: (index: number, element: HTMLButtonElement | null) => void;
  onSelect: (id: string) => void;
  row: CanvasOutlineRow;
  selected: boolean;
}>) {
  const chip = mapCanvasStatusToChip(row.status);
  return (
    <li>
      <button
        ref={(element) => {
          onRegister(index, element);
        }}
        type="button"
        className={styles.outlineRow}
        data-outline-id={row.id}
        data-outline-status={row.status}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(row.id)}
        onKeyDown={(event) => onNavigate(event, index)}
      >
        <span>
          <MonoCaps>{row.kindLabel}</MonoCaps>
          <strong>{row.label}</strong>
        </span>
        <Chip status={chip.status}>{chip.label}</Chip>
      </button>
    </li>
  );
});

const CanvasOutlinePanel = memo(function CanvasOutlinePanel({
  nodeCount,
  onNavigate,
  onRegister,
  onSelect,
  outline,
  selectedId,
}: Readonly<{
  nodeCount: number;
  onNavigate: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  onRegister: (index: number, element: HTMLButtonElement | null) => void;
  onSelect: (id: string) => void;
  outline: readonly CanvasOutlineRow[];
  selectedId: string;
}>) {
  return (
    <aside className={styles.outlinePanel} aria-labelledby="outline-title">
      <div className={styles.outlineHeader}>
        <div>
          <MonoCaps>Semantic parity</MonoCaps>
          <h2 id="outline-title">Graph outline</h2>
        </div>
        <Chip status="notes">{nodeCount} nodes</Chip>
      </div>
      <p className={styles.outlineHelp}>Topological order. Use ↑ and ↓ to move between nodes.</p>
      <ol className={styles.outlineList}>
        {outline.map((row, index) => (
          <OutlineRow
            key={row.id}
            row={row}
            index={index}
            selected={selectedId === row.id}
            onSelect={onSelect}
            onNavigate={onNavigate}
            onRegister={onRegister}
          />
        ))}
      </ol>
    </aside>
  );
});

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

function campaignTitleFromModel(model: CanvasModel, dataMode: 'preview' | 'worker'): string {
  if (dataMode === 'preview') return 'Lumen Skin launch pack';
  const brief = model.nodes.find((node) => node.id === 'brief');
  const product =
    typeof brief?.parameters.product === 'string' ? brief.parameters.product.trim() : '';
  return product.length > 0 ? `${product} launch pack` : 'Launch pack';
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
        {result.clearedDraftIds !== undefined && result.clearedDraftIds.length > 0 ? (
          <> Collaboration drafts checkpointed into this revision.</>
        ) : null}
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
  if (result.type === 'session_expired') {
    return <SessionExpiredAction className={`${styles.resultBanner} ${styles.resultInvalid}`} />;
  }
  if (result.type === 'forbidden' || result.type === 'not_found' || result.type === 'error') {
    const message =
      result.type === 'forbidden'
        ? 'You do not have permission to update this canvas.'
        : result.type === 'not_found'
          ? `Canvas ${result.canvas_id} was not found.`
          : result.message;
    return (
      <div
        className={`${styles.resultBanner} ${styles.resultInvalid}`}
        role="alert"
        data-result={result.type}
      >
        <strong>Canvas update failed</strong>
        <span>{message}</span>
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

export function CanvasLoadNotice({
  onRetry,
  result,
}: Readonly<{
  onRetry?: () => void;
  result: Exclude<CanvasReadResult, { type: 'ok' }> | null;
}>) {
  if (result === null) {
    return (
      <div className={styles.resultBanner} role="status" data-result="loading">
        Loading canvas from Core…
      </div>
    );
  }
  if (result.type === 'session_expired') {
    return <SessionExpiredAction className={`${styles.resultBanner} ${styles.resultInvalid}`} />;
  }
  const message =
    result.type === 'forbidden'
      ? 'You do not have access to this canvas.'
      : result.type === 'not_found'
        ? `Canvas ${result.canvas_id} was not found.`
        : result.message;
  return (
    <div
      className={`${styles.resultBanner} ${styles.resultInvalid}`}
      role="alert"
      data-result={result.type}
    >
      <strong>Canvas unavailable</strong>
      <span>{message}</span>
      {result.type === 'error' && result.retryable && onRetry !== undefined ? (
        <Button variant="ghost" onClick={onRetry}>
          Try loading again
        </Button>
      ) : null}
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
      <span className={styles.nodeEvidence} data-node-evidence>
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
  canvasId,
  dataMode = 'worker',
  fixtureNodeCount = 12,
  readPort: suppliedReadPort,
  scenario = 'ok',
  workspace,
}: Readonly<{
  canvasId?: string;
  dataMode?: 'preview' | 'worker';
  fixtureNodeCount?: CanvasFixtureNodeCount;
  readPort?: CanvasReadPort;
  scenario?: CanvasPortScenario;
  workspace: string;
}>) {
  const [previewPort] = useState(() =>
    dataMode === 'preview'
      ? new InMemoryCanvasPort({ nodeCount: fixtureNodeCount, scenario })
      : null,
  );
  const [readPort] = useState<CanvasReadPort | null>(() => {
    if (suppliedReadPort !== undefined) return suppliedReadPort;
    if (previewPort !== null) return previewPort;
    if (canvasId === undefined || canvasId.length === 0) return null;
    return new WorkerCanvasReadPort(createBrowserCoreClient(), canvasId);
  });
  const [mutationPort] = useState<CanvasMutationPort | null>(() => {
    if (previewPort !== null) return previewPort;
    if (canvasId === undefined || canvasId.length === 0) return null;
    return new WorkerCanvasMutationPort(createBrowserCoreClient(), canvasId, () =>
      createMutationIdempotencyKey('canvas-patch'),
    );
  });
  const [model, setModel] = useState<CanvasModel | null>(() =>
    dataMode === 'preview' ? createCanvasFixture(fixtureNodeCount) : null,
  );
  const [loadResult, setLoadResult] = useState<Exclude<CanvasReadResult, { type: 'ok' }> | null>(
    () =>
      dataMode === 'worker' &&
      suppliedReadPort === undefined &&
      (canvasId === undefined || canvasId.length === 0)
        ? {
            type: 'error',
            message: 'Open this screen from a project with a canvas selected.',
            retryable: false,
          }
        : null,
  );
  const [selectedId, setSelectedId] = useState('2');
  const [result, setResult] = useState<CanvasPortResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [checkpointing, setCheckpointing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 1120, height: 620 });
  const [arrivalNodeId, setArrivalNodeId] = useState<string | null>(null);
  const [textDrafts, setTextDrafts] = useState<Record<string, Record<string, string>>>({});
  const surfaceRef = useRef<HTMLDivElement>(null);
  const graphPlaneRef = useRef<HTMLDivElement>(null);
  const livePanRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const pointerRef = useRef<{
    id: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const outlineRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (dataMode === 'preview' || readPort === null) return;
    let active = true;
    void readPort.read().then((next) => {
      if (!active) return;
      if (next.type === 'ok') {
        setModel(next.model);
        setLoadResult(null);
      } else {
        setLoadResult(next);
      }
    });
    return () => {
      active = false;
    };
  }, [dataMode, readPort]);

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
    () => new Map((model?.nodes ?? []).map((node) => [node.id, node])),
    [model?.nodes],
  );
  const outline = useMemo(() => mapCanvasNodesToOutline(model?.nodes ?? []), [model?.nodes]);
  const selectedNode = nodesById.get(selectedId);
  const collaborationCanvasId = canvasId ?? (dataMode === 'preview' ? 'preview-canvas' : null);
  const collaboration = useCollaborationSession({
    canvasId: collaborationCanvasId,
    actor: collaborationActorForReviewer(
      dataMode === 'preview' ? 'Maya Chen' : 'You',
      dataMode === 'preview' ? 'preview' : 'websocket',
    ),
    surface: 'canvas',
    transport: dataMode === 'preview' ? 'preview' : 'websocket',
  });
  const collaborationActorId = collaborationActorForReviewer(
    dataMode === 'preview' ? 'Maya Chen' : 'You',
    dataMode === 'preview' ? 'preview' : 'websocket',
  ).actor_id;
  const anchoredComments = commentsForAnchor(collaboration.snapshot, selectedId);
  const selectedDrafts = textDrafts[selectedId] ?? {};
  const checkpointDrafts = resolveCheckpointDrafts({
    snapshotTextDrafts: collaboration.snapshot?.text_drafts ?? [],
    localDrafts: textDrafts,
  });
  const hasCheckpointDrafts = checkpointDrafts.length > 0;

  function submitCollaborationComment(body: string): void {
    collaboration.upsertComment({
      comment_id: `comment-${selectedId}-${String(Date.now())}`,
      body,
      anchor_node_id: selectedId,
    });
  }

  function updateCollaborationDraft(fieldPath: string, value: string): void {
    setTextDrafts((current) => ({
      ...current,
      [selectedId]: {
        ...(current[selectedId] ?? {}),
        [fieldPath]: value,
      },
    }));
  }

  function syncCollaborationDraft(input: {
    nodeId: string;
    fieldPath: string;
    body: string;
  }): void {
    collaboration.upsertTextDraft({
      node_id: input.nodeId,
      field_path: input.fieldPath,
      body: input.body,
    });
  }

  const lineage = useMemo(
    () => (model === null ? new Set<string>() : lineageFor(model, selectedId)),
    [model, selectedId],
  );
  const simplified = isSimplifiedCanvasLod(zoom);
  const visibleNodes = useMemo(() => {
    const left = -pan.x / zoom - VIRTUALIZATION_MARGIN;
    const top = -pan.y / zoom - VIRTUALIZATION_MARGIN;
    const right = left + viewport.width / zoom + VIRTUALIZATION_MARGIN * 2;
    const bottom = top + viewport.height / zoom + VIRTUALIZATION_MARGIN * 2;
    return (model?.nodes ?? []).filter(
      (node) =>
        node.x + GOLDEN_NODE_WIDTH >= left &&
        node.x <= right &&
        node.y + NODE_HEIGHT >= top &&
        node.y <= bottom,
    );
  }, [model?.nodes, pan.x, pan.y, viewport.height, viewport.width, zoom]);
  const visibleEdges = useMemo(() => {
    const visibleNodeIds = new Set(visibleNodes.map(({ id }) => id));
    return (model?.edges ?? []).filter(
      (edge) => visibleNodeIds.has(edge.source_node_id) && visibleNodeIds.has(edge.target_node_id),
    );
  }, [model?.edges, visibleNodes]);

  const setZoomClamped = (next: number) => setZoom(Math.min(1.4, Math.max(0.12, next)));

  function fitToView() {
    if (model === null) return;
    const nextZoom = Math.min(
      1,
      Math.max(
        0.12,
        Math.min((viewport.width - 32) / model.width, (viewport.height - 32) / model.height),
      ),
    );
    setZoom(nextZoom);
    setPan({
      x: Math.max(0, (viewport.width - model.width * nextZoom) / 2),
      y: Math.max(0, (viewport.height - model.height * nextZoom) / 2),
    });
  }

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || (event.target as Element).closest('button, a')) return;
    pointerRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    livePanRef.current = pan;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointerRef.current;
    if (pointer === null || pointer.id !== event.pointerId) return;
    const nextPan = {
      x: pointer.panX + event.clientX - pointer.x,
      y: pointer.panY + event.clientY - pointer.y,
    };
    livePanRef.current = nextPan;
    if (graphPlaneRef.current !== null) {
      graphPlaneRef.current.style.transform = `translate3d(${String(nextPan.x)}px, ${String(nextPan.y)}px, 0) scale(${String(zoomRef.current)})`;
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerRef.current?.id === event.pointerId) {
      pointerRef.current = null;
      setPan(livePanRef.current);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom((current) => {
      const next = Math.min(1.4, Math.max(0.12, current - event.deltaY * 0.001));
      zoomRef.current = next;
      return next;
    });
  }

  async function validateCanvas() {
    if (mutationPort === null || model === null) return;
    setValidating(true);
    const nextResult = await mutationPort.validateAndApply(model);
    setResult(nextResult);
    if (nextResult.type === 'ok') setModel(nextResult.model);
    setValidating(false);
  }

  async function checkpointDraftsToRevision() {
    if (mutationPort === null || model === null || !hasCheckpointDrafts) return;
    setCheckpointing(true);
    const checkpointResult = await checkpointCanvasDrafts({
      model,
      drafts: checkpointDrafts,
      mutationPort,
    });
    if (checkpointResult.type === 'ok') {
      setModel(checkpointResult.model);
      setResult({
        type: 'ok',
        model: checkpointResult.model,
        clearedDraftIds: checkpointResult.clearedDraftIds,
      });
      collaboration.clearCheckpointedDrafts(
        checkpointResult.clearedDraftIds,
        checkpointResult.revisionId,
      );
      setTextDrafts((current) => {
        const next = { ...current };
        for (const draft of checkpointDrafts) {
          const nodeDrafts = next[draft.node_id];
          if (nodeDrafts === undefined) continue;
          const remaining = { ...nodeDrafts };
          delete remaining[draft.field_path];
          if (Object.keys(remaining).length === 0) {
            delete next[draft.node_id];
          } else {
            next[draft.node_id] = remaining;
          }
        }
        return next;
      });
    } else if (checkpointResult.type !== 'no_drafts') {
      setResult(checkpointResult);
    }
    setCheckpointing(false);
  }

  async function reloadLatest() {
    if (previewPort !== null) {
      const next = await previewPort.reloadLatest();
      setModel(next.model);
      setResult(next);
      return;
    }
    if (readPort === null) return;
    const next = await readPort.read();
    if (next.type === 'ok') {
      setModel(next.model);
      setResult(next);
      setLoadResult(null);
    } else {
      setLoadResult(next);
    }
  }

  const selectNode = useCallback((id: string) => setSelectedId(id), []);

  const registerOutlineRef = useCallback((index: number, element: HTMLButtonElement | null) => {
    outlineRefs.current[index] = element;
  }, []);

  const handleOutlineKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (index + direction + outline.length) % outline.length;
      outlineRefs.current[nextIndex]?.focus();
    },
    [outline.length],
  );

  if (model === null) {
    return (
      <main id="main-content" className={styles.canvasPage}>
        <section className={styles.workspace} aria-label="ViralGraph canvas">
          <CanvasLoadNotice result={loadResult} onRetry={() => void reloadLatest()} />
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className={styles.canvasPage}>
      <section className={styles.workspace} aria-label="ViralGraph canvas">
        <div className={styles.toolbar}>
          <div>
            <MonoCaps>Canvas revision {model.revision}</MonoCaps>
            <span className={styles.toolbarTitle}>{campaignTitleFromModel(model, dataMode)}</span>
          </div>
          <div className={styles.toolbarActions}>
            <MonoCaps data-testid="virtualized-count">
              {visibleNodes.length} / {model.nodes.length} nodes mounted
            </MonoCaps>
            <MonoCaps data-collaboration-status={collaboration.status}>
              {collaboration.snapshot?.presence.filter((entry) => entry.surface === 'canvas')
                .length ?? 0}{' '}
              live
            </MonoCaps>
            <Button aria-label="Zoom out" onClick={() => setZoomClamped(zoom - 0.1)}>
              −
            </Button>
            <MonoCaps>{Math.round(zoom * 100)}%</MonoCaps>
            <Button aria-label="Zoom in" onClick={() => setZoomClamped(zoom + 0.1)}>
              +
            </Button>
            <Button onClick={fitToView}>Fit</Button>
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
              disabled={mutationPort === null || result?.type === 'session_expired'}
              onClick={() => void validateCanvas()}
            >
              Validate graph
            </Button>
            <Button
              feedback={
                checkpointing
                  ? 'loading'
                  : result?.type === 'ok' && hasCheckpointDrafts === false
                    ? 'success'
                    : result?.type === 'conflict'
                      ? 'error'
                      : 'default'
              }
              loadingLabel="Checkpointing"
              disabled={
                mutationPort === null ||
                !hasCheckpointDrafts ||
                result?.type === 'session_expired' ||
                checkpointing
              }
              onClick={() => void checkpointDraftsToRevision()}
            >
              Checkpoint drafts
            </Button>
          </div>
        </div>
        <CanvasResultBanner result={result} onReload={() => void reloadLatest()} />
        <div
          ref={surfaceRef}
          className={styles.canvasSurface}
          data-testid="canvas-surface"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <div
            ref={graphPlaneRef}
            className={styles.graphPlane}
            data-testid="graph-plane"
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
              {visibleEdges.map((edge) => (
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
                onSelect={() => selectNode(node.id)}
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
            <MonoCaps>{canvasQuotePresentation(dataMode).route}</MonoCaps>
          </div>
          <div>
            <MonoCaps>Quote basis</MonoCaps>
            <MonoCaps>{canvasQuotePresentation(dataMode).basis}</MonoCaps>
          </div>
          {result?.type === 'session_expired' ? null : (
            <Link
              className="mbv-button mbv-button--primary"
              href={
                canvasId === undefined
                  ? `/studio/${workspace}/quote`
                  : `/studio/${workspace}/quote?canvas=${encodeURIComponent(canvasId)}&revision=${encodeURIComponent(model.revision)}`
              }
            >
              {canvasQuotePresentation(dataMode).cta}
            </Link>
          )}
        </div>
      </section>
      <div className={styles.sideRail}>
        <CanvasOutlinePanel
          nodeCount={model.nodes.length}
          outline={outline}
          selectedId={selectedId}
          onSelect={selectNode}
          onNavigate={handleOutlineKeyDown}
          onRegister={registerOutlineRef}
        />
        <CollaborationSidebar
          anchorId={selectedId}
          anchorLabel={selectedNode?.label ?? 'Selected node'}
          comments={anchoredComments}
          draftPanel={
            <NodeConfigDraftPanel
              actorId={collaborationActorId}
              localDrafts={selectedDrafts}
              nodeId={selectedId}
              nodeKind={selectedNode?.kind}
              nodeLabel={selectedNode?.label ?? 'Selected node'}
              snapshot={collaboration.snapshot}
              onAcquireLease={collaboration.acquireLease}
              onReleaseLease={collaboration.releaseLease}
              onChange={updateCollaborationDraft}
              onSyncDraft={syncCollaborationDraft}
            />
          }
          onSubmitComment={submitCollaborationComment}
          snapshot={collaboration.snapshot}
          status={collaboration.status}
          surface="canvas"
        />
      </div>
      <footer className={styles.footer}>
        <MonoCaps>Latency: 142ms · Node count: {model.nodes.length} · Region: us-east-1</MonoCaps>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </main>
  );
}
