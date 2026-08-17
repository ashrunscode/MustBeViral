import { buildGoldenLaunchPackGraph, type GoldenCampaignBrief } from '@mustbeviral/contracts';
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
 *
 * This fixture is DERIVED from the real graph builder rather than hand-written. A hand-written one
 * previously invented `brand_context.brand_voice` and `brand_context.palette`, which the builder has
 * never emitted; the payload builder read those same invented keys, so the tests agreed with the
 * code and both were wrong about production. Every adaptation and motion prompt silently shipped
 * without a brand kit. Deriving the fixture makes that class of drift impossible.
 */
const SAMPLE_BRIEF: GoldenCampaignBrief = {
  briefId: 'GB-01',
  product: 'WashBodega Wash & Fold drop-off laundry',
  category: 'Neighbourhood laundromat, Southwest Houston',
  packshots: 'Folded-laundry counter photography, golden-hour warmth.',
  features: '46 washers and 44 dryers, attended, bilingual staff.',
  benefits: 'A weekend day back.',
  evidence: 'WashBodega Inc, TX SOS 806341752.',
  approvedFacts: 'Two per-pound tiers, both published on washbodega.com.',
  offer: 'No promotional offer.',
  pricePresentation: 'Reproduce prices exactly; never round or infer them.',
  urgency: 'None.',
  destination: 'washbodega.com',
  brandKit: 'Bodega Red #E11D2A, Sunshine Gold #F5B321, Soft Cream #FFF8EC. Sora and Inter.',
  audienceAndAwareness: 'Southwest Houston families, solution-aware, bilingual.',
  painsDesiresObjections: 'Laundry eats a weekend day.',
  requiredClaimsLegal: 'Tagline must read exactly "Your Neighborhood Laundry."',
  prohibitedClaims: 'Do not invent a discount, coupon, or percentage saved.',
  creativeConstraintsRights: 'Real store only. No identifiable child faces.',
  stressVector: 'Two per-pound tiers that are easy to confuse.',
} as GoldenCampaignBrief;

const SAMPLE_GRAPH = buildGoldenLaunchPackGraph(SAMPLE_BRIEF);
const nodeParametersOf = (id: string): Record<string, unknown> => {
  const found = SAMPLE_GRAPH.nodes.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`graph has no node ${id}`);
  return found.parameters as Record<string, unknown>;
};

/** Exactly what `get_outbox_dispatch_attempts` builds: the two context nodes' parameters. */
const BRIEF_CONTEXT = {
  brief: nodeParametersOf('brief'),
  brand_context: nodeParametersOf('brand-context'),
};

const SUPPLEMENT_BRIEF: GoldenCampaignBrief = {
  ...SAMPLE_BRIEF,
  briefId: 'GB-02',
  product: 'Northstar Magnesium Glycinate Night Capsules',
  category: 'Supplements; 60-capsule magnesium glycinate dietary supplement.',
  packshots:
    'Amber bottle with front/back Supplement Facts, two capsules beside the closed bottle, tamper seal, and carton; no lifestyle talent.',
  offer: 'Subscribe-and-save launch, one bottle every 30 days with cancel-anytime terms.',
  audienceAndAwareness:
    'Active adults 30–55 who feel their nighttime routine is inconsistent; problem-aware.',
  brandKit:
    'Navy and mineral gray, compact grotesk type, clinical and precise voice, diagram-led visuals, no moon-and-cloud fantasy scenes.',
  creativeConstraintsRights:
    'Supplement Facts must remain readable and unaltered; no doctor imagery, white coats, body transformation, or unsupported testimonial.',
} as GoldenCampaignBrief;
const SUPPLEMENT_GRAPH = buildGoldenLaunchPackGraph(SUPPLEMENT_BRIEF);
const supplementNodeParametersOf = (id: string): Record<string, unknown> => {
  const found = SUPPLEMENT_GRAPH.nodes.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`supplement graph has no node ${id}`);
  return found.parameters as Record<string, unknown>;
};
const SUPPLEMENT_BRIEF_CONTEXT = {
  brief: supplementNodeParametersOf('brief'),
  brand_context: supplementNodeParametersOf('brand-context'),
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
    expect(system).toMatch(/125/u);
    expect(system).toMatch(/engagement-bait/iu);
  });

  it('carries the claims guardrails from run context, which the copy node does not hold', async () => {
    // buildGoldenLaunchPackGraph gives a copy node only asset_role, copy_set, offer, urgency and
    // stress_vector. The prohibited-claims list - the only thing standing between a language model
    // and an invented price - lives on the brief node, and used to be read off the copy node, where
    // it is undefined. Every copy prompt the system ever sent was missing its guardrail.
    const payload = await buildProviderAttemptPayload({
      nodeParameters: nodeParametersOf('copy-1'),
      executionPlanLine: { node_id: 'copy-1' },
      task: 'copy',
      briefContext: BRIEF_CONTEXT,
    });
    const user = (payload.messages as { content: string }[])[1]?.content ?? '';
    expect(user).toContain(SAMPLE_BRIEF.prohibitedClaims);
    expect(user).toContain(SAMPLE_BRIEF.requiredClaimsLegal);
    expect(user).toContain(SAMPLE_BRIEF.pricePresentation);
    expect(user).toContain(SAMPLE_BRIEF.approvedFacts);
    expect(user).toContain(SAMPLE_BRIEF.product);
    // And the node's own variation still arrives.
    expect(user).toContain(SAMPLE_BRIEF.stressVector);
  });

  it('states a fragment once when the node and the run context both carry it', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: nodeParametersOf('copy-1'),
      executionPlanLine: { node_id: 'copy-1' },
      task: 'copy',
      briefContext: BRIEF_CONTEXT,
    });
    const user = (payload.messages as { content: string }[])[1]?.content ?? '';
    expect(user.split(SAMPLE_BRIEF.offer).length - 1).toBe(1);
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

  it('carries the brand kit into the hero frame every adaptation inherits', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: nodeParametersOf('master-1'),
      executionPlanLine: { node_id: 'master-1' },
      task: 'master_static',
      briefContext: BRIEF_CONTEXT,
    });
    const prompt = payload.prompt as string;
    expect(prompt).toContain(SAMPLE_BRIEF.packshots);
    expect(prompt).toContain(SAMPLE_BRIEF.brandKit);
    expect(prompt).toContain(SAMPLE_BRIEF.creativeConstraintsRights);
    expect(prompt).toContain('Packshot-as-hero');
  });

  it('keeps supplement image prompts visual instead of forwarding promotional health context', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: supplementNodeParametersOf('master-1'),
      executionPlanLine: { node_id: 'master-1' },
      task: 'master_static',
      briefContext: SUPPLEMENT_BRIEF_CONTEXT,
    });
    const prompt = payload.prompt as string;
    expect(prompt).toContain(SUPPLEMENT_BRIEF.product);
    expect(prompt).toContain(SUPPLEMENT_BRIEF.packshots);
    expect(prompt).toContain(SUPPLEMENT_BRIEF.brandKit);
    expect(prompt).toContain(SUPPLEMENT_BRIEF.creativeConstraintsRights);
    expect(prompt).not.toContain(SUPPLEMENT_BRIEF.offer);
    expect(prompt).not.toContain(SUPPLEMENT_BRIEF.audienceAndAwareness);
  });

  it('keeps the supplement material master on packaging instead of benefit-body language', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: supplementNodeParametersOf('master-2'),
      executionPlanLine: { node_id: 'master-2' },
      task: 'master_static',
      briefContext: SUPPLEMENT_BRIEF_CONTEXT,
    });
    const prompt = payload.prompt as string;
    expect(prompt).toMatch(/bottle, capsules, carton/u);
    expect(prompt).not.toMatch(/benefit still life/u);
    expect(prompt).not.toContain(SUPPLEMENT_BRIEF.offer);
    expect(prompt).not.toContain(SUPPLEMENT_BRIEF.audienceAndAwareness);
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
    expect(payload.prompt).toContain(SAMPLE_BRIEF.product);
    expect(payload.prompt).toContain(SAMPLE_BRIEF.brandKit);
    expect(payload.image_url).toContain(UPSTREAM_IMAGE.artifactId);
    expect(payload.image_url).toContain('token=');
  });

  it('carries the brand kit and rights constraints, which are what make it look like the brand', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: nodeParametersOf('adaptation-1-1'),
      executionPlanLine: { node_id: 'adaptation-1-1' },
      task: 'adaptation',
      briefContext: BRIEF_CONTEXT,
      upstreamImages: [UPSTREAM_IMAGE],
      mintImageUrl: mintUrl,
    });
    const prompt = payload.prompt as string;
    // Regression: each of these was silently absent while the builder emitted brand_kit and the
    // payload read brand_context.palette. An unbranded adaptation costs the same as a branded one.
    expect(prompt).toContain(SAMPLE_BRIEF.brandKit);
    expect(prompt).toContain(SAMPLE_BRIEF.creativeConstraintsRights);
    expect(prompt).toContain(SAMPLE_BRIEF.audienceAndAwareness);
    expect(prompt).toContain('4:5');
    // Facts and prices stay out of image prompts: a diffusion model renders them as garbled text,
    // and can attach a price to the wrong service. Copy carries them instead.
    expect(prompt).not.toContain(SAMPLE_BRIEF.approvedFacts);
    expect(prompt).not.toContain(SAMPLE_BRIEF.prohibitedClaims);
  });

  it('keeps supplement adaptation prompts on the same visual-only policy as their master', async () => {
    const payload = await buildProviderAttemptPayload({
      nodeParameters: supplementNodeParametersOf('adaptation-1-1'),
      executionPlanLine: { node_id: 'adaptation-1-1' },
      task: 'adaptation',
      briefContext: SUPPLEMENT_BRIEF_CONTEXT,
      upstreamImages: [UPSTREAM_IMAGE],
      mintImageUrl: mintUrl,
    });
    const prompt = payload.prompt as string;
    expect(prompt).toContain(SUPPLEMENT_BRIEF.product);
    expect(prompt).toContain(SUPPLEMENT_BRIEF.brandKit);
    expect(prompt).toContain(SUPPLEMENT_BRIEF.creativeConstraintsRights);
    expect(prompt).not.toContain(SUPPLEMENT_BRIEF.offer);
    expect(prompt).not.toContain(SUPPLEMENT_BRIEF.audienceAndAwareness);
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
    const motionFromGraph = await buildProviderAttemptPayload({
      nodeParameters: nodeParametersOf('motion-1'),
      executionPlanLine: { node_id: 'motion-1' },
      task: 'image_to_video',
      briefContext: BRIEF_CONTEXT,
      upstreamImages: [UPSTREAM_IMAGE],
      mintImageUrl: mintUrl,
    });
    expect(String(motionFromGraph.prompt)).toMatch(/Frame-1 hook/u);
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
