import { usdMicros, type ModelPriceUnit } from '../../../../packages/billing/src/index';
import {
  falFlux2ProDescriptor,
  falFluxKontextProDescriptor,
  falSeedanceLiteDescriptor,
  moonshotKimiK26Descriptor,
} from '../../../../packages/provider/src/catalog';
import type { CatalogQuotePlan } from '../../../../packages/contracts/src/index';
import type { GraphSnapshot } from '../../../../packages/graph/src/index';

export interface LaunchCatalogVersion {
  readonly id: string;
  readonly effective_at: string;
  readonly status: string;
}

export interface LaunchModelRoute {
  readonly id: string;
  readonly provider_model_id: string;
  readonly route_key: string;
}

export interface LaunchModelRoutePrice {
  readonly model_route_id: string;
  readonly price_catalog_version_id: string;
  readonly unit: string;
  readonly unit_price_micros: number;
}

export interface LaunchCatalogRecords {
  readonly versions: readonly LaunchCatalogVersion[];
  readonly routes: readonly LaunchModelRoute[];
  readonly prices: readonly LaunchModelRoutePrice[];
}

const routeDefinitions = [
  {
    role: 'copy_set',
    routeKey: moonshotKimiK26Descriptor.routeId,
    unit: 'request',
    quantity: () => 1n,
    fixturePriceMicros: 100_000,
  },
  {
    role: 'master_static',
    routeKey: falFlux2ProDescriptor.routeId,
    unit: 'image',
    quantity: () => 1n,
    fixturePriceMicros:
      falFlux2ProDescriptor.price.firstMegapixelMicros +
      falFlux2ProDescriptor.price.additionalMegapixelMicros,
  },
  {
    role: 'adaptation',
    routeKey: falFluxKontextProDescriptor.routeId,
    unit: 'image',
    quantity: () => 1n,
    fixturePriceMicros: falFluxKontextProDescriptor.price.perImageMicros,
  },
  {
    role: 'motion_branch',
    routeKey: falSeedanceLiteDescriptor.routeId,
    unit: 'video_second',
    quantity: (parameters: GraphSnapshot['nodes'][number]['parameters']) => {
      const seconds = parameters.duration_seconds;
      if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) || seconds <= 0) {
        throw new TypeError('Motion nodes require a positive integer duration_seconds');
      }
      return BigInt(seconds);
    },
    fixturePriceMicros: 100_000,
  },
] as const satisfies readonly {
  readonly role: string;
  readonly routeKey: string;
  readonly unit: ModelPriceUnit;
  readonly quantity: (parameters: GraphSnapshot['nodes'][number]['parameters']) => bigint;
  readonly fixturePriceMicros: number;
}[];

function selectedCatalog(records: LaunchCatalogRecords): Readonly<{
  version: LaunchCatalogVersion;
  routes: ReadonlyMap<string, LaunchModelRoute>;
  prices: ReadonlyMap<string, LaunchModelRoutePrice>;
}> {
  const routes = new Map(records.routes.map((route) => [route.route_key, route]));
  for (const version of records.versions) {
    if (version.status !== 'active') continue;
    const prices = new Map(
      records.prices
        .filter((price) => price.price_catalog_version_id === version.id)
        .map((price) => [`${price.model_route_id}\u0000${price.unit}`, price]),
    );
    const complete = routeDefinitions.every((definition) => {
      const route = routes.get(definition.routeKey);
      return route !== undefined && prices.has(`${route.id}\u0000${definition.unit}`);
    });
    if (complete) return { version, routes, prices };
  }
  throw new RangeError('No active launch price catalog covers every required route');
}

export function buildLaunchCatalogQuotePlan(
  snapshot: GraphSnapshot,
  records: LaunchCatalogRecords,
): CatalogQuotePlan {
  const catalog = selectedCatalog(records);
  const prices = routeDefinitions.map((definition) => {
    const route = catalog.routes.get(definition.routeKey);
    if (route === undefined) throw new RangeError(`Missing launch route ${definition.routeKey}`);
    const price = catalog.prices.get(`${route.id}\u0000${definition.unit}`);
    if (price === undefined)
      throw new RangeError(`Missing launch price for ${definition.routeKey}`);
    return {
      priceCatalogVersionId: catalog.version.id,
      modelRouteId: route.id,
      providerModelId: route.provider_model_id,
      unit: definition.unit,
      unitPriceMicros: usdMicros(BigInt(price.unit_price_micros)),
    };
  });
  const nodes = snapshot.nodes.flatMap<CatalogQuotePlan['nodes'][number]>((node) => {
    const role = node.parameters.asset_role;
    const definition = routeDefinitions.find((candidate) => candidate.role === role);
    if (definition === undefined) return [];
    const route = catalog.routes.get(definition.routeKey);
    if (route === undefined) throw new RangeError(`Missing launch route ${definition.routeKey}`);
    return [
      {
        nodeId: node.id,
        modelRouteId: route.id,
        pricingUnits: [{ unit: definition.unit, quantity: definition.quantity(node.parameters) }],
      },
    ];
  });
  if (nodes.length === 0) throw new RangeError('The graph contains no launch-pack output nodes');
  return { priceCatalogVersionId: catalog.version.id, prices, nodes };
}

export function fixtureLaunchCatalogRecords(): LaunchCatalogRecords {
  const versionId = 'golden-launch-pack-v1';
  const routes = routeDefinitions.map((definition) => {
    const descriptor = [
      moonshotKimiK26Descriptor,
      falFlux2ProDescriptor,
      falFluxKontextProDescriptor,
      falSeedanceLiteDescriptor,
    ].find((candidate) => candidate.routeId === definition.routeKey);
    if (descriptor === undefined) throw new RangeError(`Missing descriptor ${definition.routeKey}`);
    return {
      id: descriptor.routeId,
      provider_model_id: descriptor.modelId,
      route_key: descriptor.routeId,
    };
  });
  return {
    versions: [{ id: versionId, effective_at: '2026-07-19T00:00:00.000Z', status: 'active' }],
    routes,
    prices: routeDefinitions.map((definition) => ({
      model_route_id: definition.routeKey,
      price_catalog_version_id: versionId,
      unit: definition.unit,
      unit_price_micros: definition.fixturePriceMicros,
    })),
  };
}
