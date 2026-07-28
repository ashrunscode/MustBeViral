import { describe, expect, it } from 'vitest';

import { assembleQuote, quoteExpiryState, type ModelCatalogPrice } from './quote';
import { usdMicros } from './money';

const catalog: readonly ModelCatalogPrice[] = [
  {
    priceCatalogVersionId: 'catalog-v1',
    modelRouteId: 'route-text',
    providerModelId: 'moonshot/kimi',
    unit: 'input_token',
    unitPriceMicros: usdMicros(1n),
  },
  {
    priceCatalogVersionId: 'catalog-v1',
    modelRouteId: 'route-text',
    providerModelId: 'moonshot/kimi',
    unit: 'output_token',
    unitPriceMicros: usdMicros(4n),
  },
  {
    priceCatalogVersionId: 'catalog-v1',
    modelRouteId: 'route-image',
    providerModelId: 'fal-ai/flux-2-pro',
    unit: 'image',
    unitPriceMicros: usdMicros(45_000n),
  },
  {
    priceCatalogVersionId: 'catalog-v1',
    modelRouteId: 'route-video',
    providerModelId: 'fal-ai/bytedance/seedance/v1/pro/fast/image-to-video',
    unit: 'video_second',
    unitPriceMicros: usdMicros(22_000n),
  },
];

function quote() {
  return assembleQuote({
    quoteId: 'quote-1',
    workspaceId: 'workspace-1',
    canvasRevisionId: 'revision-1',
    priceCatalogVersionId: 'catalog-v1',
    createdAt: '2026-07-19T12:00:00.000Z',
    catalogPrices: catalog,
    nodes: [
      {
        nodeId: 'copy',
        modelRouteId: 'route-text',
        pricingUnits: [
          { unit: 'input_token', quantity: 40_000n },
          { unit: 'output_token', quantity: 15_000n },
        ],
      },
      {
        nodeId: 'masters',
        modelRouteId: 'route-image',
        pricingUnits: [{ unit: 'image', quantity: 3n }],
      },
      {
        nodeId: 'motion',
        modelRouteId: 'route-video',
        pricingUnits: [{ unit: 'video_second', quantity: 6n }],
      },
    ],
  });
}

describe('quote assembly', () => {
  it('composes exact per-node catalog prices and quote total', () => {
    const result = quote();
    expect(result.nodeLines.map((line) => line.totalMicros)).toEqual([
      100_000n,
      135_000n,
      132_000n,
    ]);
    expect(result.maximumChargeMicros).toBe(367_000n);
    expect(typeof result.maximumChargeMicros).toBe('bigint');
  });

  it('pins catalog, revision, provider model, and USD currency', () => {
    const result = quote();
    expect(result).toMatchObject({
      canvasRevisionId: 'revision-1',
      priceCatalogVersionId: 'catalog-v1',
      currency: 'USD',
    });
    expect(result.nodeLines[0]?.providerModelId).toBe('moonshot/kimi');
  });

  it('creates an exact immutable fifteen-minute window', () => {
    const result = quote();
    expect(result.createdAt).toBe('2026-07-19T12:00:00.000Z');
    expect(result.expiresAt).toBe('2026-07-19T12:15:00.000Z');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nodeLines)).toBe(true);
    expect(Object.isFrozen(result.nodeLines[0]?.priceComponents)).toBe(true);
  });

  it('treats the instant before expiry as active', () => {
    expect(quoteExpiryState(quote(), '2026-07-19T12:14:59.999Z')).toBe('active');
  });

  it('treats exact expiry and later instants as expired', () => {
    expect(quoteExpiryState(quote(), '2026-07-19T12:15:00.000Z')).toBe('expired');
    expect(quoteExpiryState(quote(), '2026-07-19T12:15:00.001Z')).toBe('expired');
  });

  it('rejects a mutated quote window', () => {
    expect(() =>
      quoteExpiryState(
        {
          createdAt: '2026-07-19T12:00:00.000Z',
          expiresAt: '2026-07-19T12:14:59.999Z',
        },
        '2026-07-19T12:01:00.000Z',
      ),
    ).toThrow('exactly 15 minutes');
  });

  it('rejects missing catalog prices', () => {
    expect(() =>
      assembleQuote({
        quoteId: 'quote-1',
        workspaceId: 'workspace-1',
        canvasRevisionId: 'revision-1',
        priceCatalogVersionId: 'catalog-v1',
        createdAt: '2026-07-19T12:00:00.000Z',
        catalogPrices: catalog,
        nodes: [
          {
            nodeId: 'bad-node',
            modelRouteId: 'route-image',
            pricingUnits: [{ unit: 'request', quantity: 1n }],
          },
        ],
      }),
    ).toThrow('No catalog price');
  });

  it('rejects duplicate catalog and node-unit prices', () => {
    expect(() =>
      assembleQuote({
        quoteId: 'quote-1',
        workspaceId: 'workspace-1',
        canvasRevisionId: 'revision-1',
        priceCatalogVersionId: 'catalog-v1',
        createdAt: '2026-07-19T12:00:00.000Z',
        catalogPrices: [...catalog, catalog[0] as ModelCatalogPrice],
        nodes: [
          {
            nodeId: 'copy',
            modelRouteId: 'route-text',
            pricingUnits: [{ unit: 'input_token', quantity: 1n }],
          },
        ],
      }),
    ).toThrow('Duplicate catalog price');

    expect(() =>
      assembleQuote({
        quoteId: 'quote-1',
        workspaceId: 'workspace-1',
        canvasRevisionId: 'revision-1',
        priceCatalogVersionId: 'catalog-v1',
        createdAt: '2026-07-19T12:00:00.000Z',
        catalogPrices: catalog,
        nodes: [
          {
            nodeId: 'copy',
            modelRouteId: 'route-text',
            pricingUnits: [
              { unit: 'input_token', quantity: 1n },
              { unit: 'input_token', quantity: 1n },
            ],
          },
        ],
      }),
    ).toThrow('repeats pricing unit');
  });

  it('rejects empty plans and invalid timestamps', () => {
    expect(() =>
      assembleQuote({
        quoteId: 'quote-1',
        workspaceId: 'workspace-1',
        canvasRevisionId: 'revision-1',
        priceCatalogVersionId: 'catalog-v1',
        createdAt: 'not-a-date',
        catalogPrices: catalog,
        nodes: [],
      }),
    ).toThrow();
  });
});
