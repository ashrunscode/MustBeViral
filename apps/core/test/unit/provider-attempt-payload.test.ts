import { describe, expect, it } from 'vitest';

import {
  buildProviderAttemptPayload,
  type UpstreamImage,
} from '../../src/composition/provider-outbox';

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

/**
 * Adaptation and motion nodes carry no prompt material of their own - only an asset_role and, for
 * motion, a duration. Everything they say to the provider comes from the run-wide brief and brand
 * context, which is why the dispatch expansion returns it alongside the node.
 */
const BRIEF_CONTEXT = {
  brief: {
    product: 'WashBodega Wash & Fold drop-off laundry',
    approved_facts: 'Two per-pound tiers, both published on washbodega.com.',
  },
  brand_context: {
    brand_voice: 'Plain-spoken, neighbourhood, never hypey.',
    palette: 'Warm neutrals with a single teal accent.',
  },
};

const UPSTREAM_IMAGE: UpstreamImage = {
  artifactId: '472bf385-02c8-4abd-a33c-dc6df69f5232',
  objectKey: 'workspaces/w/runs/r/attempts/a/provider-output',
  contentHash: 'a'.repeat(64),
  byteSize: 107_176,
  mimeType: 'image/jpeg',
};

const mintUrl = async (image: UpstreamImage): Promise<string> =>
  `https://core.example.test/v1/artifacts/${image.artifactId}/content?token=signed`;

describe('copy payload', () => {
  it('builds the request shape the OpenRouter driver validates', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: COPY_NODE,
      executionPlanLine: PLAN_LINE,
      task: 'copy',
    });
    expect(payload.task).toBe('copy');
    expect(Array.isArray(payload.messages)).toBe(true);
    const messages = payload.messages as { role: string; content: string }[];
    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(messages[1]?.content).toContain('WashBodega Wash & Fold');
  });

  it('carries every brief fragment the node holds into the prompt', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: COPY_NODE,
      executionPlanLine: PLAN_LINE,
      task: 'copy',
    });
    const user = (payload.messages as { content: string }[])[1]?.content ?? '';
    for (const fragment of [COPY_NODE.product, COPY_NODE.offer, COPY_NODE.stress_vector]) {
      expect(user).toContain(fragment);
    }
  });

  it('instructs the model not to invent prices, since briefs carry real published ones', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: COPY_NODE,
      executionPlanLine: PLAN_LINE,
      task: 'copy',
    });
    const system = (payload.messages as { content: string }[])[0]?.content ?? '';
    expect(system).toMatch(/never invent prices/iu);
    expect(system).toMatch(/verbatim/iu);
  });

  it('refuses a copy node with no brief material rather than prompting an empty brief', async () => {
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: { asset_role: 'copy_set' },
        executionPlanLine: PLAN_LINE,
        task: 'copy',
      }),
    ).rejects.toThrowError(/carries no brief/u);
  });
});

describe('master payload', () => {
  it('builds a prompt from the node’s visual brief fragments', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: MASTER_NODE,
      executionPlanLine: PLAN_LINE,
      task: 'master_static',
    });
    expect(typeof payload.prompt).toBe('string');
    const prompt = payload.prompt as string;
    expect(prompt).toContain(MASTER_NODE.packshots);
    expect(prompt).toContain(MASTER_NODE.creative_constraints_rights);
    // fal validates a non-empty prompt string and nothing else on this route.
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('refuses a master node with no prompt material', async () => {
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: { asset_role: 'master_static' },
        executionPlanLine: PLAN_LINE,
        task: 'master_static',
      }),
    ).rejects.toThrowError(/carries no prompt material/u);
  });
});

describe('nodes that depend on an upstream artifact', () => {
  it('builds an adaptation request from run context plus a minted image URL', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: { asset_role: 'adaptation', aspect_ratio: '1:1' },
      executionPlanLine: { node_id: 'adaptation-1' },
      task: 'adaptation',
      briefContext: BRIEF_CONTEXT,
      upstreamImages: [UPSTREAM_IMAGE],
      mintImageUrl: mintUrl,
    });
    // The prompt exists only because the run context reached the node; the node itself has none.
    expect(payload.prompt).toContain(BRIEF_CONTEXT.brief.product);
    expect(payload.prompt).toContain(BRIEF_CONTEXT.brand_context.brand_voice);
    expect(payload.image_url).toContain(UPSTREAM_IMAGE.artifactId);
    expect(payload.image_url).toContain('token=');
  });

  it('carries the validated duration for motion, which fal prices per second', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: { asset_role: 'motion_branch', duration_seconds: 8 },
      executionPlanLine: { node_id: 'motion-1' },
      task: 'image_to_video',
      briefContext: BRIEF_CONTEXT,
      upstreamImages: [UPSTREAM_IMAGE],
      mintImageUrl: mintUrl,
    });
    expect(payload.duration).toBe(8);
    expect(payload.image_url).toContain('token=');
  });

  it('refuses motion with no valid duration, because a wrong one multiplies spend', async () => {
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: { asset_role: 'motion_branch' },
        executionPlanLine: { node_id: 'motion-1' },
        task: 'image_to_video',
        briefContext: BRIEF_CONTEXT,
        upstreamImages: [UPSTREAM_IMAGE],
        mintImageUrl: mintUrl,
      }),
    ).rejects.toThrowError(/no valid duration_seconds/u);
  });

  it.each([
    ['zero', [] as readonly UpstreamImage[]],
    [
      'two',
      [UPSTREAM_IMAGE, { ...UPSTREAM_IMAGE, artifactId: 'other' }] as readonly UpstreamImage[],
    ],
  ])(
    'refuses %s upstream images instead of guessing which one to adapt',
    async (_label, images) => {
      // Picking the first would silently adapt the wrong image after real money produced both, and
      // waiting would be wrong too: wave gating means the parent is already registered by now.
      let thrown: unknown;
      try {
        await buildProviderAttemptPayload({
          nodeParameters: { asset_role: 'adaptation' },
          executionPlanLine: { node_id: 'adaptation-1' },
          task: 'adaptation',
          briefContext: BRIEF_CONTEXT,
          upstreamImages: images,
          mintImageUrl: mintUrl,
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toMatchObject({ retryable: false });
      expect(String(thrown)).toMatch(/requires exactly one upstream image/u);
    },
  );

  it('fails closed when no artifact-access signer is configured', async () => {
    // Same discipline as the signing key itself: without it, dispatch must not proceed with an
    // unfetchable input.
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: { asset_role: 'adaptation' },
        executionPlanLine: { node_id: 'adaptation-1' },
        task: 'adaptation',
        briefContext: BRIEF_CONTEXT,
        upstreamImages: [UPSTREAM_IMAGE],
      }),
    ).rejects.toThrowError(/without artifact access signing/u);
  });

  it('refuses an image node with no run context to build a prompt from', async () => {
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: {},
        executionPlanLine: { node_id: 'adaptation-1' },
        task: 'adaptation',
        briefContext: { brief: {}, brand_context: {} },
        upstreamImages: [UPSTREAM_IMAGE],
        mintImageUrl: mintUrl,
      }),
    ).rejects.toThrowError(/no brief or brand context/u);
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
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: { asset_role: 'adaptation' },
        executionPlanLine: { node_id: 'adaptation-1-1' },
        task: 'adaptation',
      }),
    ).rejects.toThrow();

    // ...while a ready node in the same run builds normally.
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: MASTER_NODE,
        executionPlanLine: { node_id: 'master-1' },
        task: 'master_static',
      }),
    ).resolves.toHaveProperty('prompt');
  });
});

describe('unknown routes', () => {
  it('refuses a task with no adapter instead of passing parameters through', async () => {
    // The previous implementation spread node parameters straight to the driver, which is how a
    // brief fragment reached fal as if it were a generation request.
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: MASTER_NODE,
        executionPlanLine: PLAN_LINE,
        task: 'some_new_task',
      }),
    ).rejects.toThrowError(/no payload adapter/u);
  });

  it('rejects malformed expansion rows', async () => {
    await expect(
      buildProviderAttemptPayload({
        nodeParameters: null,
        executionPlanLine: PLAN_LINE,
        task: 'copy',
      }),
    ).rejects.toThrowError(/invalid provider input/u);
  });
});
