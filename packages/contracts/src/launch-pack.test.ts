import { describe, expect, it } from 'vitest';

import {
  COPY_SET_ANGLES,
  MASTER_VISUAL_DIRECTIONS,
  PRODUCT_ONLY_VISUAL_RIGHTS,
  SUPPLEMENT_MASTER_VISUAL_DIRECTIONS,
  SUPPLEMENT_PACKSHOT_HERO_DIRECTION,
  buildFailedImageProbeGraph,
  buildGoldenLaunchPackGraph,
  graphLooksLikeLaunchPack,
  imageSafeText,
  launchPackShapeOf,
} from './launch-pack';
import { evaluateLaunchPackCopy, parseLaunchPackCopy } from './launch-pack-qa';

const brief = {
  briefId: 'GB-01',
  product: 'Dewline Barrier Cloud Cream',
  category: 'Skincare',
  packshots: 'White pump',
  features: 'Ceramides',
  benefits: 'Soft barrier feel',
  evidence: 'Perception study',
  approvedFacts: 'Fragrance-free',
  offer: 'Launch offer',
  pricePresentation: '$38',
  urgency: 'Launch week',
  destination: 'https://dewline.example/products/barrier-cloud',
  brandKit: 'Cobalt, fog white',
  audienceAndAwareness: 'Adults 25–44; unaware',
  painsDesiresObjections: 'Dry areas',
  requiredClaimsLegal: 'Supports the skin’s moisture barrier. Results vary.',
  prohibitedClaims: 'No eczema treatment',
  creativeConstraintsRights: 'Product-only',
  stressVector: 'Unaware education',
} as const;

describe('launch pack graph', () => {
  it('pins three distinct copy angles and three distinct master directions', () => {
    const graph = buildGoldenLaunchPackGraph(brief);
    expect(launchPackShapeOf(graph)).toEqual({
      masterStatics: 3,
      adaptations: 9,
      copySets: 3,
      motionBranches: 1,
    });
    const copyAngles = graph.nodes
      .filter((node) => node.parameters.asset_role === 'copy_set')
      .map((node) => node.parameters.angle);
    expect(copyAngles).toEqual([...COPY_SET_ANGLES]);
    const masters = graph.nodes
      .filter((node) => node.parameters.asset_role === 'master_static')
      .map((node) => node.parameters.visual_direction);
    expect(masters).toEqual([...MASTER_VISUAL_DIRECTIONS]);
    expect(new Set(copyAngles).size).toBe(3);
    expect(new Set(masters).size).toBe(3);
    expect(MASTER_VISUAL_DIRECTIONS[1]).not.toMatch(/\bmedical\b/iu);
    expect(graphLooksLikeLaunchPack(graph, brief.product)).toBe(true);
    expect(graphLooksLikeLaunchPack(graph, 'Other product')).toBe(false);
  });

  it('keeps every supplement master on the policy-proven packshot direction', () => {
    const graph = buildGoldenLaunchPackGraph({
      ...brief,
      briefId: 'GB-02',
      product: 'Northstar Magnesium Glycinate Night Capsules.',
      category: 'Supplements; 60-capsule magnesium glycinate dietary supplement.',
    });
    const masters = graph.nodes
      .filter((node) => node.parameters.asset_role === 'master_static')
      .map((node) => node.parameters.visual_direction);
    expect(masters).toEqual([...SUPPLEMENT_MASTER_VISUAL_DIRECTIONS]);
    expect(masters).toEqual([
      SUPPLEMENT_PACKSHOT_HERO_DIRECTION,
      SUPPLEMENT_PACKSHOT_HERO_DIRECTION,
      SUPPLEMENT_PACKSHOT_HERO_DIRECTION,
    ]);
    expect(masters.join('\n')).not.toMatch(/material still life|proof-forward composition/iu);
  });

  it('builds a one-master probe with the same visual fields as the launch pack', () => {
    const supplement = {
      ...brief,
      briefId: 'GB-02',
      product: 'Northstar Magnesium Glycinate Night Capsules.',
      category: 'Supplements; 60-capsule magnesium glycinate dietary supplement.',
      packshots: 'Amber bottle with front/back Supplement Facts.',
      creativeConstraintsRights:
        'Supplement Facts must remain readable; no doctor imagery, white coats, body transformation.',
    };
    const probe = buildFailedImageProbeGraph(supplement, 2);
    expect(probe.nodes.map((node) => node.id)).toEqual(['brief', 'brand-context', 'master-2']);
    expect(
      probe.nodes.filter((node) => node.parameters.asset_role === 'master_static'),
    ).toHaveLength(1);
    expect(probe.nodes.find((node) => node.id === 'master-2')?.parameters.visual_direction).toBe(
      SUPPLEMENT_MASTER_VISUAL_DIRECTIONS[1],
    );
    expect(probe.nodes.some((node) => node.parameters.asset_role === 'copy_set')).toBe(false);
    expect(probe.nodes.some((node) => node.parameters.asset_role === 'adaptation')).toBe(false);
  });
});

describe('imageSafeText', () => {
  it('replaces a named medical prohibition list instead of sending the banned words', () => {
    expect(
      imageSafeText(
        'Supplement Facts must remain readable; no doctor imagery, white coats, body transformation.',
      ),
    ).toBe(PRODUCT_ONLY_VISUAL_RIGHTS);
  });

  it('strips clinical voice from a brand kit without dropping the palette', () => {
    expect(
      imageSafeText(
        'Navy and mineral gray, compact grotesk type, clinical and precise voice, no moon-and-cloud fantasy scenes.',
      ),
    ).toBe(
      'Navy and mineral gray, compact grotesk type, and precise voice, no moon-and-cloud fantasy scenes.',
    );
  });

  it('leaves a product-only packshot line unchanged', () => {
    expect(
      imageSafeText(
        'Amber bottle with front/back Supplement Facts, two capsules beside the closed bottle.',
      ),
    ).toBe('Amber bottle with front/back Supplement Facts, two capsules beside the closed bottle.');
  });
});

describe('launch pack copy QA', () => {
  it('parses structured copy and rejects bait plus overlong primary text', () => {
    const parsed = parseLaunchPackCopy(
      JSON.stringify({
        primary_text: `${'Tag a friend if you want softer skin. '.repeat(5)}`,
        headline: 'A headline that is definitely longer than forty characters',
        description: 'Support line',
      }),
    );
    expect(parsed).not.toBeNull();
    const findings = evaluateLaunchPackCopy(parsed!);
    expect(findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        'COPY_PRIMARY_TOO_LONG',
        'COPY_HEADLINE_TOO_LONG',
        'COPY_ENGAGEMENT_BAIT',
      ]),
    );
  });

  it('unwraps OpenRouter { text, usage } envelopes and markdown completions', () => {
    expect(
      parseLaunchPackCopy(
        JSON.stringify({
          text: '```json\n{"headline":"Keep nights simple","primary_text":"200 mg glycinate.","description":"FDA disclaimer."}\n```',
          usage: { total_tokens: 80 },
        }),
      ),
    ).toEqual({
      headline: 'Keep nights simple',
      primary_text: '200 mg glycinate.',
      description: 'FDA disclaimer.',
    });
    expect(
      parseLaunchPackCopy(
        JSON.stringify({
          text: '**Stillroom Countertop Compost Caddy**\n*Home • 1.2-gallon kitchen scrap container*\n\n**Kitchen Reset Bundle**\nIncludes the caddy, filters, and a liner sample.',
          usage: { total_tokens: 120 },
        }),
      ),
    ).toEqual({
      headline: 'Stillroom Countertop Compost Caddy',
      primary_text: 'Home • 1.2-gallon kitchen scrap container',
      description: 'Kitchen Reset Bundle Includes the caddy, filters, and a liner sample.',
    });
  });

  it('parses fenced JSON and camelCase aliases used by live copy artifacts', () => {
    expect(
      parseLaunchPackCopy(
        '```json\n{"headline":"Keep nights simple","primary_text":"200 mg glycinate.","description":"FDA disclaimer."}\n```',
      ),
    ).toEqual({
      headline: 'Keep nights simple',
      primary_text: '200 mg glycinate.',
      description: 'FDA disclaimer.',
    });
    expect(
      parseLaunchPackCopy(
        JSON.stringify({
          title: 'Keep nights simple',
          primaryText: '200 mg glycinate.',
          support: 'FDA disclaimer.',
        }),
      ),
    ).toEqual({
      headline: 'Keep nights simple',
      primary_text: '200 mg glycinate.',
      description: 'FDA disclaimer.',
    });
  });

  it('stops offer description before spec-section tails', () => {
    expect(
      parseLaunchPackCopy(
        JSON.stringify({
          headline: 'Stillroom Countertop Compost Caddy',
          primary_text: 'Home | 1.2-gallon kitchen scrap container',
          description:
            'Kitchen Reset Bundle Includes: Countertop Compost Caddy (1.2-gallon) $129 Design & Dimensions 15-in height',
        }),
      ),
    ).toEqual({
      headline: 'Stillroom Countertop Compost Caddy',
      primary_text: 'Home | 1.2-gallon kitchen scrap container',
      description: 'Kitchen Reset Bundle Includes: Countertop Compost Caddy (1.2-gallon) $129',
    });
  });
});
