import {
  ZERO_USD_MICROS,
  addUsdMicros,
  multiplyUsdMicros,
  usdMicros,
  type UsdMicros,
} from './money';

export const QUOTE_WINDOW_MILLISECONDS = 15 * 60 * 1000;

export const modelPriceUnits = [
  'request',
  'image',
  'video_second',
  'input_token',
  'output_token',
] as const;

export type ModelPriceUnit = (typeof modelPriceUnits)[number];

export interface ModelCatalogPrice {
  readonly priceCatalogVersionId: string;
  readonly modelRouteId: string;
  readonly providerModelId: string;
  readonly unit: ModelPriceUnit;
  readonly unitPriceMicros: UsdMicros;
}

export interface NodePricingUnit {
  readonly unit: ModelPriceUnit;
  readonly quantity: bigint;
}

export interface QuoteNodeRequest {
  readonly nodeId: string;
  readonly modelRouteId: string;
  readonly pricingUnits: readonly NodePricingUnit[];
}

export interface QuotePriceComponent {
  readonly unit: ModelPriceUnit;
  readonly quantity: bigint;
  readonly unitPriceMicros: UsdMicros;
  readonly totalMicros: UsdMicros;
}

export interface QuoteNodeLine {
  readonly nodeId: string;
  readonly modelRouteId: string;
  readonly providerModelId: string;
  readonly priceComponents: readonly QuotePriceComponent[];
  readonly totalMicros: UsdMicros;
}

export interface ImmutableRunQuote {
  readonly quoteId: string;
  readonly workspaceId: string;
  readonly canvasRevisionId: string;
  readonly priceCatalogVersionId: string;
  readonly currency: 'USD';
  readonly nodeLines: readonly QuoteNodeLine[];
  readonly maximumChargeMicros: UsdMicros;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export type QuoteExpiryState = 'active' | 'expired';

export interface AssembleQuoteInput {
  readonly quoteId: string;
  readonly workspaceId: string;
  readonly canvasRevisionId: string;
  readonly priceCatalogVersionId: string;
  readonly createdAt: string;
  readonly catalogPrices: readonly ModelCatalogPrice[];
  readonly nodes: readonly QuoteNodeRequest[];
}

function requireText(value: string, field: string): void {
  if (value.length === 0) {
    throw new TypeError(`${field} must not be empty`);
  }
}

function timestampMilliseconds(value: string, field: string): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new TypeError(`${field} must be a valid timestamp`);
  }
  return milliseconds;
}

function freezeComponent(component: QuotePriceComponent): QuotePriceComponent {
  return Object.freeze(component);
}

function freezeLine(line: QuoteNodeLine): QuoteNodeLine {
  return Object.freeze({
    ...line,
    priceComponents: Object.freeze(line.priceComponents.map(freezeComponent)),
  });
}

export function assembleQuote(input: AssembleQuoteInput): ImmutableRunQuote {
  requireText(input.quoteId, 'quoteId');
  requireText(input.workspaceId, 'workspaceId');
  requireText(input.canvasRevisionId, 'canvasRevisionId');
  requireText(input.priceCatalogVersionId, 'priceCatalogVersionId');
  if (input.nodes.length === 0) {
    throw new RangeError('A quote requires at least one node');
  }

  const createdAtMilliseconds = timestampMilliseconds(input.createdAt, 'createdAt');
  const createdAt = new Date(createdAtMilliseconds).toISOString();
  const expiresAt = new Date(createdAtMilliseconds + QUOTE_WINDOW_MILLISECONDS).toISOString();

  const catalogIndex = new Map<string, ModelCatalogPrice>();
  for (const price of input.catalogPrices) {
    if (price.priceCatalogVersionId !== input.priceCatalogVersionId) {
      continue;
    }
    usdMicros(price.unitPriceMicros);
    const key = `${price.modelRouteId}\u0000${price.unit}`;
    if (catalogIndex.has(key)) {
      throw new RangeError(
        `Duplicate catalog price for route ${price.modelRouteId} and ${price.unit}`,
      );
    }
    catalogIndex.set(key, price);
  }

  const nodeLines = input.nodes.map((node): QuoteNodeLine => {
    requireText(node.nodeId, 'nodeId');
    requireText(node.modelRouteId, 'modelRouteId');
    if (node.pricingUnits.length === 0) {
      throw new RangeError(`Node ${node.nodeId} requires at least one pricing unit`);
    }

    let providerModelId: string | undefined;
    let nodeTotal = ZERO_USD_MICROS;
    const seenUnits = new Set<ModelPriceUnit>();
    const priceComponents = node.pricingUnits.map((usage): QuotePriceComponent => {
      if (seenUnits.has(usage.unit)) {
        throw new RangeError(`Node ${node.nodeId} repeats pricing unit ${usage.unit}`);
      }
      seenUnits.add(usage.unit);
      const price = catalogIndex.get(`${node.modelRouteId}\u0000${usage.unit}`);
      if (price === undefined) {
        throw new RangeError(
          `No catalog price for route ${node.modelRouteId} and unit ${usage.unit}`,
        );
      }
      if (providerModelId !== undefined && providerModelId !== price.providerModelId) {
        throw new RangeError(`Catalog route ${node.modelRouteId} has inconsistent provider models`);
      }
      providerModelId = price.providerModelId;
      const totalMicros = multiplyUsdMicros(price.unitPriceMicros, usage.quantity);
      nodeTotal = addUsdMicros(nodeTotal, totalMicros);
      return {
        unit: usage.unit,
        quantity: usage.quantity,
        unitPriceMicros: price.unitPriceMicros,
        totalMicros,
      };
    });

    return freezeLine({
      nodeId: node.nodeId,
      modelRouteId: node.modelRouteId,
      providerModelId: providerModelId ?? '',
      priceComponents,
      totalMicros: nodeTotal,
    });
  });

  const maximumChargeMicros = nodeLines.reduce(
    (total, line) => addUsdMicros(total, line.totalMicros),
    ZERO_USD_MICROS,
  );

  return Object.freeze({
    quoteId: input.quoteId,
    workspaceId: input.workspaceId,
    canvasRevisionId: input.canvasRevisionId,
    priceCatalogVersionId: input.priceCatalogVersionId,
    currency: 'USD',
    nodeLines: Object.freeze(nodeLines),
    maximumChargeMicros,
    createdAt,
    expiresAt,
  });
}

export function quoteExpiryState(
  quote: Pick<ImmutableRunQuote, 'createdAt' | 'expiresAt'>,
  now: string,
): QuoteExpiryState {
  const createdAt = timestampMilliseconds(quote.createdAt, 'createdAt');
  const expiresAt = timestampMilliseconds(quote.expiresAt, 'expiresAt');
  if (expiresAt - createdAt !== QUOTE_WINDOW_MILLISECONDS) {
    throw new RangeError('Quote expiry must be exactly 15 minutes after creation');
  }
  return timestampMilliseconds(now, 'now') >= expiresAt ? 'expired' : 'active';
}
