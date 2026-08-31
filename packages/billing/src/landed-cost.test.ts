import { describe, expect, it } from 'vitest';

import {
  computePackLandedCost,
  emptyPackLandedCostEvidence,
  type PackLandedCostEvidence,
} from './landed-cost';

const CATALOG_CHARGE = 4_550_000n;

describe('computePackLandedCost', () => {
  it('returns null landed cost when provider cost is not observable', () => {
    const evidence: PackLandedCostEvidence = {
      providerCostMicros: null,
      providerCostObservability: 'not_observable',
      storageCostMicros: 12_000n,
      executionCostMicros: 8_000n,
      artifactEvidenceMicros: 5_000n,
      catalogCustomerChargeMicros: CATALOG_CHARGE,
    };
    const result = computePackLandedCost(evidence);
    expect(result.landedCostMicros).toBeNull();
    expect(result.fullyObservable).toBe(false);
    expect(result.catalogCustomerChargeMicros).toBe(CATALOG_CHARGE);
    expect(result.catalogChargeIsCustomerPrice).toBe(true);
  });

  it('sums observable components into landed cost micros', () => {
    const evidence: PackLandedCostEvidence = {
      providerCostMicros: 680_000n,
      providerCostObservability: 'observed',
      storageCostMicros: 12_000n,
      executionCostMicros: 8_000n,
      artifactEvidenceMicros: 5_000n,
      catalogCustomerChargeMicros: CATALOG_CHARGE,
    };
    const result = computePackLandedCost(evidence);
    expect(result.landedCostMicros).toBe(705_000n);
    expect(result.fullyObservable).toBe(true);
    expect(result.catalogCustomerChargeMicros).toBe(CATALOG_CHARGE);
    expect(result.landedCostMicros).not.toBe(result.catalogCustomerChargeMicros);
  });

  it('provides an empty evidence template with catalog charge only', () => {
    const evidence = emptyPackLandedCostEvidence(CATALOG_CHARGE);
    const result = computePackLandedCost(evidence);
    expect(result.landedCostMicros).toBeNull();
    expect(result.catalogCustomerChargeMicros).toBe(CATALOG_CHARGE);
  });
});
