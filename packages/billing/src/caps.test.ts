import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GLOBAL_DAY_CAP_MICROS,
  DEFAULT_RUN_CAP_MICROS,
  DEFAULT_WORKSPACE_DAY_CAP_MICROS,
  checkReservationCaps,
} from './caps';
import { usdMicros } from './money';

function check(reservation: bigint, workspaceExposure = 0n, globalExposure = 0n) {
  return checkReservationCaps({
    reservationMicros: usdMicros(reservation),
    workspaceDayExposureMicros: usdMicros(workspaceExposure),
    globalDayExposureMicros: usdMicros(globalExposure),
  });
}

describe('start-run reservation cap checks', () => {
  it('uses migration-matching default caps', () => {
    expect(DEFAULT_RUN_CAP_MICROS).toBe(8_000_000n);
    expect(DEFAULT_WORKSPACE_DAY_CAP_MICROS).toBe(25_000_000n);
    expect(DEFAULT_GLOBAL_DAY_CAP_MICROS).toBe(100_000_000n);
  });

  it('allows exact equality at all three caps', () => {
    expect(check(8_000_000n, 17_000_000n, 92_000_000n)).toEqual({
      status: 'ok',
      reservationMicros: 8_000_000n,
      projectedWorkspaceDayMicros: 25_000_000n,
      projectedGlobalDayMicros: 100_000_000n,
    });
  });

  it('returns a typed per-run cap trip first', () => {
    expect(check(8_000_001n)).toEqual({
      status: 'cap_exceeded',
      tier: 'run',
      capMicros: 8_000_000n,
      currentExposureMicros: 0n,
      requestedMicros: 8_000_001n,
      projectedMicros: 8_000_001n,
    });
  });

  it('returns a typed workspace-day cap trip', () => {
    expect(check(2_000_001n, 23_000_000n)).toMatchObject({
      status: 'cap_exceeded',
      tier: 'workspace_day',
      projectedMicros: 25_000_001n,
    });
  });

  it('returns a typed global-day cap trip', () => {
    expect(check(2_000_001n, 1_000_000n, 98_000_000n)).toMatchObject({
      status: 'cap_exceeded',
      tier: 'global_day',
      projectedMicros: 100_000_001n,
    });
  });

  it('supports zero-cost reservations', () => {
    expect(check(0n)).toMatchObject({ status: 'ok', reservationMicros: 0n });
  });
});
