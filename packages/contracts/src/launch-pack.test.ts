import { describe, expect, it } from 'vitest';

import {
  COPY_SET_ANGLES,
  MASTER_VISUAL_DIRECTIONS,
  SUPPLEMENT_MASTER_VISUAL_DIRECTIONS,
  buildGoldenLaunchPackGraph,
  graphLooksLikeLaunchPack,
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
    expect(graphLooksLikeLaunchPack(graph, brief.product)).toBe(true);
    expect(graphLooksLikeLaunchPack(graph, 'Other product')).toBe(false);
  });

  it('keeps supplement masters on packaging instead of benefit-body still life', () => {
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
    expect(String(masters[1])).toMatch(/bottle, capsules, carton/u);
    expect(String(masters[1])).not.toMatch(/benefit still life/u);
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
});
