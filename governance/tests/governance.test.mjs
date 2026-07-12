import assert from 'node:assert/strict';
import test from 'node:test';

import { collectDocumentErrors } from '../scripts/validate-docs.mjs';
import { collectPacketErrors } from '../scripts/validate-work-packet.mjs';
import { hasAbsolutePath, pathMatches } from '../scripts/lib.mjs';

const baseManifest = () => ({
  documents: [
    {
      id: 'product',
      path: 'docs/product.md',
      status: 'accepted',
      authority_topics: ['product.customer'],
      supersedes: [],
    },
    {
      id: 'architecture',
      path: 'docs/architecture.md',
      status: 'accepted',
      authority_topics: ['architecture.system'],
      supersedes: [],
    },
  ],
});

const baseSources = () => ({
  sources: [{ id: 'source', used_by: ['product'], reverify_after: '2099-01-01' }],
});

const baseState = () => ({
  project_state: 'active',
  active_work_packet: 'WP-R0-001',
  phase: { id: 'R0' },
  decisions_pending: [],
  blockers: [],
});

const basePacket = () => ({
  id: 'WP-R0-001',
  phase: 'R0',
  status: 'in_progress',
  branch: 'codex/viralgraph-cleanroom',
  authority_refs: ['product'],
  scope: {
    allowed_paths: ['docs/**', 'governance/**'],
    forbidden_paths: ['docs/archive/**'],
    required_doc_ids: ['architecture'],
  },
  steps: [{ id: 'step-1', status: 'current' }],
  acceptance: { automated: [], manual: [] },
  quality_gates: [],
  handoff: { current_step: 'step-1', blockers: [] },
  completion: { successor_packet_id: 'WP-R0-002' },
});

test('accepts one authority owner per topic', () => {
  assert.deepEqual(collectDocumentErrors({ manifest: baseManifest(), sources: baseSources() }), []);
});

test('rejects duplicate authority ownership', () => {
  const manifest = baseManifest();
  manifest.documents[1].authority_topics = ['product.customer'];
  assert.match(
    collectDocumentErrors({ manifest, sources: baseSources() }).join('\n'),
    /owned by both/,
  );
});

test('rejects missing supersession targets and cycles', () => {
  const manifest = baseManifest();
  manifest.documents[0].supersedes = ['architecture'];
  manifest.documents[1].supersedes = ['product'];
  assert.match(collectDocumentErrors({ manifest, sources: baseSources() }).join('\n'), /cycle/);
});

test('rejects stale research used by authority', () => {
  const sources = baseSources();
  sources.sources[0].reverify_after = '2020-01-01';
  assert.match(
    collectDocumentErrors({
      manifest: baseManifest(),
      sources,
      today: new Date('2026-01-01'),
    }).join('\n'),
    /stale/,
  );
});

test('accepts a coherent active packet', () => {
  assert.deepEqual(
    collectPacketErrors({
      state: baseState(),
      packet: basePacket(),
      manifest: baseManifest(),
      branch: 'codex/viralgraph-cleanroom',
    }),
    [],
  );
});

test('rejects unresolved decisions in active work', () => {
  const state = baseState();
  state.decisions_pending = ['choose something'];
  assert.match(
    collectPacketErrors({ state, packet: basePacket(), manifest: baseManifest() }).join('\n'),
    /unresolved decisions/,
  );
});

test('rejects blocked state without a blocker', () => {
  const state = baseState();
  state.project_state = 'blocked';
  assert.match(
    collectPacketErrors({ state, packet: basePacket(), manifest: baseManifest() }).join('\n'),
    /no blocker/,
  );
});

test('rejects two current steps', () => {
  const packet = basePacket();
  packet.steps.push({ id: 'step-2', status: 'current' });
  assert.match(
    collectPacketErrors({ state: baseState(), packet, manifest: baseManifest() }).join('\n'),
    /exactly one/,
  );
});

test('rejects changes outside packet scope and forbidden archive paths', () => {
  const errors = collectPacketErrors({
    state: baseState(),
    packet: basePacket(),
    manifest: baseManifest(),
    changes: ['apps/web/page.tsx', 'docs/archive/old.md'],
  });
  assert.equal(errors.filter((error) => error.includes('outside packet scope')).length, 2);
});

test('rejects completed packets without evidence', () => {
  const packet = basePacket();
  packet.status = 'complete';
  packet.steps[0].status = 'completed';
  packet.acceptance.automated.push({ status: 'passed', evidence: [] });
  packet.quality_gates.push({ status: 'passed', evidence: [] });
  assert.match(
    collectPacketErrors({ state: baseState(), packet, manifest: baseManifest() }).join('\n'),
    /without evidence|unproved quality/,
  );
});

test('detects absolute paths recursively', () => {
  assert.equal(hasAbsolutePath({ evidence: ['C:\\secret\\result.txt'] }), true);
  assert.equal(hasAbsolutePath({ evidence: ['docs/evidence/result.md'] }), false);
});

test('path matcher includes dotfiles and rejects unrelated files', () => {
  assert.equal(pathMatches('.agents/skills/build/SKILL.md', ['.agents/**']), true);
  assert.equal(pathMatches('apps/web/page.tsx', ['docs/**', 'governance/**']), false);
});
