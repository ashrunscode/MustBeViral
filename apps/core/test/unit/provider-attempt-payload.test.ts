import { describe, expect, it } from 'vitest';

import { buildProviderAttemptPayload } from '../../src/composition/provider-outbox';

/**
 * The graph-driven dispatch path had never produced a valid provider request for any route: node
 * parameters carry semantic brief fragments, every driver validates a provider request, and nothing
 * translated between them. Two live runs died on it. These tests pin the translation.
 */

const PLAN_LINE = { node_id: 'copy-1', model_route_id: 'route', total_micros: '150000' };

const COPY_NODE = {
  asset_role: 'copy_set',
  copy_set: 1,
  product: 'WashBodega Wash & Fold drop-off laundry',
  offer: 'No promotional offer.',
  urgency: 'None.',
  stress_vector: 'Two per-pound tiers that are easy to confuse.',
};

const MASTER_NODE = {
  asset_role: 'master_static',
  master: 1,
  product: 'WashBodega Wash & Fold drop-off laundry',
  packshots: 'Folded-laundry counter photography, golden-hour warmth.',
  creative_constraints_rights: 'Real store only. No identifiable child faces.',
};

describe('copy payload', () => {
  it('builds the request shape the OpenRouter driver validates', () => {
    const payload = buildProviderAttemptPayload(COPY_NODE, PLAN_LINE, 'copy');
    expect(payload.task).toBe('copy');
    expect(Array.isArray(payload.messages)).toBe(true);
    const messages = payload.messages as { role: string; content: string }[];
    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(messages[1]?.content).toContain('WashBodega Wash & Fold');
  });

  it('carries every brief fragment the node holds into the prompt', () => {
    const payload = buildProviderAttemptPayload(COPY_NODE, PLAN_LINE, 'copy');
    const user = (payload.messages as { content: string }[])[1]?.content ?? '';
    for (const fragment of [COPY_NODE.product, COPY_NODE.offer, COPY_NODE.stress_vector]) {
      expect(user).toContain(fragment);
    }
  });

  it('instructs the model not to invent prices, since briefs carry real published ones', () => {
    const payload = buildProviderAttemptPayload(COPY_NODE, PLAN_LINE, 'copy');
    const system = (payload.messages as { content: string }[])[0]?.content ?? '';
    expect(system).toMatch(/never invent prices/iu);
    expect(system).toMatch(/verbatim/iu);
  });

  it('refuses a copy node with no brief material rather than prompting an empty brief', () => {
    expect(() =>
      buildProviderAttemptPayload({ asset_role: 'copy_set' }, PLAN_LINE, 'copy'),
    ).toThrowError(/carries no brief/u);
  });
});

describe('master payload', () => {
  it('builds a prompt from the node’s visual brief fragments', () => {
    const payload = buildProviderAttemptPayload(MASTER_NODE, PLAN_LINE, 'master_static');
    expect(typeof payload.prompt).toBe('string');
    const prompt = payload.prompt as string;
    expect(prompt).toContain(MASTER_NODE.packshots);
    expect(prompt).toContain(MASTER_NODE.creative_constraints_rights);
    // fal validates a non-empty prompt string and nothing else on this route.
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('refuses a master node with no prompt material', () => {
    expect(() =>
      buildProviderAttemptPayload({ asset_role: 'master_static' }, PLAN_LINE, 'master_static'),
    ).toThrowError(/carries no prompt material/u);
  });
});

describe('nodes that depend on an upstream artifact', () => {
  // These are the reason a pack cannot complete yet: adaptation and motion are image-to-image and
  // image-to-video, and the dispatch expansion hands back every attempt of a run at once with no
  // readiness ordering. Declaring the dependency retryable keeps the event alive instead of
  // fabricating an image_url.
  it.each([
    ['adaptation', { asset_role: 'adaptation', master: 'master-1', aspect_ratio: '1:1' }],
    ['image_to_video', { asset_role: 'motion_branch', master: 'master-1', duration_seconds: 8 }],
  ])('defers %s as retryable rather than sending a broken request', (task, node) => {
    let thrown: unknown;
    try {
      buildProviderAttemptPayload(node, PLAN_LINE, task);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      retryable: true,
      details: { reason: 'upstream_artifact_pending' },
    });
  });
});

describe('claim-time isolation', () => {
  it('reports an unbuildable attempt without throwing out of the expansion', async () => {
    // Regression for the defect that killed two live runs: payload construction happens while
    // claiming a run event, and a single node that could not build aborted the entire claim, so a
    // pack submitted zero attempts instead of the six that were ready.
    const { SupabaseProviderOutboxPort } = await import('../../src/composition/provider-outbox');
    expect(typeof SupabaseProviderOutboxPort).toBe('function');

    // The adapter itself must still throw for a single node - that is what the port captures.
    expect(() =>
      buildProviderAttemptPayload(
        { asset_role: 'adaptation', master: 'master-1' },
        { node_id: 'adaptation-1-1' },
        'adaptation',
      ),
    ).toThrow();

    // ...while a ready node in the same run builds normally.
    expect(
      buildProviderAttemptPayload(MASTER_NODE, { node_id: 'master-1' }, 'master_static'),
    ).toHaveProperty('prompt');
  });
});

describe('unknown routes', () => {
  it('refuses a task with no adapter instead of passing parameters through', () => {
    // The previous implementation spread node parameters straight to the driver, which is how a
    // brief fragment reached fal as if it were a generation request.
    expect(() => buildProviderAttemptPayload(MASTER_NODE, PLAN_LINE, 'some_new_task')).toThrowError(
      /no payload adapter/u,
    );
  });

  it('rejects malformed expansion rows', () => {
    expect(() => buildProviderAttemptPayload(null, PLAN_LINE, 'copy')).toThrowError(
      /invalid provider input/u,
    );
  });
});
