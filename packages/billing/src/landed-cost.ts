import { addUsdMicros, usdMicros, ZERO_USD_MICROS, type UsdMicros } from './money';

export type ProviderCostObservability = 'observed' | 'not_observable' | 'estimated';

export interface PackLandedCostEvidence {
  readonly providerCostMicros: bigint | null;
  readonly providerCostObservability: ProviderCostObservability;
  readonly storageCostMicros: bigint;
  readonly executionCostMicros: bigint;
  readonly artifactEvidenceMicros: bigint;
  readonly catalogCustomerChargeMicros: bigint;
}

export interface PackLandedCostComponents {
  readonly providerCostMicros: bigint | null;
  readonly storageCostMicros: UsdMicros;
  readonly executionCostMicros: UsdMicros;
  readonly artifactEvidenceMicros: UsdMicros;
}

export interface PackLandedCostResult {
  readonly landedCostMicros: bigint | null;
  readonly catalogCustomerChargeMicros: UsdMicros;
  readonly components: PackLandedCostComponents;
  readonly fullyObservable: boolean;
  readonly catalogChargeIsCustomerPrice: true;
}

function componentMicros(value: bigint, field: string): UsdMicros {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new RangeError(`${field} must be a non-negative bigint`);
  }
  return usdMicros(value);
}

/**
 * Computes fully landed pack cost from immutable receipt evidence.
 * Catalog customer charge is returned separately and must not be treated as landed cost.
 */
export function computePackLandedCost(evidence: PackLandedCostEvidence): PackLandedCostResult {
  const storageCostMicros = componentMicros(evidence.storageCostMicros, 'storageCostMicros');
  const executionCostMicros = componentMicros(evidence.executionCostMicros, 'executionCostMicros');
  const artifactEvidenceMicros = componentMicros(
    evidence.artifactEvidenceMicros,
    'artifactEvidenceMicros',
  );
  const catalogCustomerChargeMicros = componentMicros(
    evidence.catalogCustomerChargeMicros,
    'catalogCustomerChargeMicros',
  );

  const observedComponents = addUsdMicros(
    addUsdMicros(storageCostMicros, executionCostMicros),
    artifactEvidenceMicros,
  );

  const providerObserved =
    evidence.providerCostObservability === 'observed' && evidence.providerCostMicros !== null;
  const providerCostMicros = providerObserved ? evidence.providerCostMicros : null;

  const landedCostMicros =
    providerObserved && providerCostMicros !== null
      ? addUsdMicros(observedComponents, componentMicros(providerCostMicros, 'providerCostMicros'))
      : null;

  return Object.freeze({
    landedCostMicros: landedCostMicros === null ? null : landedCostMicros,
    catalogCustomerChargeMicros,
    components: Object.freeze({
      providerCostMicros,
      storageCostMicros,
      executionCostMicros,
      artifactEvidenceMicros,
    }),
    fullyObservable: providerObserved,
    catalogChargeIsCustomerPrice: true,
  });
}

export function emptyPackLandedCostEvidence(
  catalogCustomerChargeMicros: bigint,
): PackLandedCostEvidence {
  return Object.freeze({
    providerCostMicros: null,
    providerCostObservability: 'not_observable',
    storageCostMicros: ZERO_USD_MICROS,
    executionCostMicros: ZERO_USD_MICROS,
    artifactEvidenceMicros: ZERO_USD_MICROS,
    catalogCustomerChargeMicros,
  });
}
