import { addUsdMicros, usdMicros, type UsdMicros } from './money';

export const DEFAULT_RUN_CAP_MICROS = usdMicros(8_000_000n);
export const DEFAULT_WORKSPACE_DAY_CAP_MICROS = usdMicros(25_000_000n);
export const DEFAULT_GLOBAL_DAY_CAP_MICROS = usdMicros(100_000_000n);

export type SpendCapTier = 'run' | 'workspace_day' | 'global_day';

export interface SpendCaps {
  readonly run: UsdMicros;
  readonly workspaceDay: UsdMicros;
  readonly globalDay: UsdMicros;
}

export interface ReservationCapInput {
  readonly reservationMicros: UsdMicros;
  readonly workspaceDayExposureMicros: UsdMicros;
  readonly globalDayExposureMicros: UsdMicros;
  readonly caps?: SpendCaps;
}

export interface ReservationCapOk {
  readonly status: 'ok';
  readonly reservationMicros: UsdMicros;
  readonly projectedWorkspaceDayMicros: UsdMicros;
  readonly projectedGlobalDayMicros: UsdMicros;
}

export interface ReservationCapExceeded {
  readonly status: 'cap_exceeded';
  readonly tier: SpendCapTier;
  readonly capMicros: UsdMicros;
  readonly currentExposureMicros: UsdMicros;
  readonly requestedMicros: UsdMicros;
  readonly projectedMicros: UsdMicros;
}

export type ReservationCapResult = ReservationCapOk | ReservationCapExceeded;

export const DEFAULT_SPEND_CAPS: SpendCaps = Object.freeze({
  run: DEFAULT_RUN_CAP_MICROS,
  workspaceDay: DEFAULT_WORKSPACE_DAY_CAP_MICROS,
  globalDay: DEFAULT_GLOBAL_DAY_CAP_MICROS,
});

function exceeded(
  tier: SpendCapTier,
  capMicros: UsdMicros,
  currentExposureMicros: UsdMicros,
  requestedMicros: UsdMicros,
): ReservationCapExceeded {
  return Object.freeze({
    status: 'cap_exceeded',
    tier,
    capMicros,
    currentExposureMicros,
    requestedMicros,
    projectedMicros: addUsdMicros(currentExposureMicros, requestedMicros),
  });
}

export function checkReservationCaps(input: ReservationCapInput): ReservationCapResult {
  const caps = input.caps ?? DEFAULT_SPEND_CAPS;
  usdMicros(input.reservationMicros);
  usdMicros(input.workspaceDayExposureMicros);
  usdMicros(input.globalDayExposureMicros);
  usdMicros(caps.run);
  usdMicros(caps.workspaceDay);
  usdMicros(caps.globalDay);

  if (input.reservationMicros > caps.run) {
    return exceeded('run', caps.run, usdMicros(0n), input.reservationMicros);
  }

  const projectedWorkspaceDayMicros = addUsdMicros(
    input.workspaceDayExposureMicros,
    input.reservationMicros,
  );
  if (projectedWorkspaceDayMicros > caps.workspaceDay) {
    return exceeded(
      'workspace_day',
      caps.workspaceDay,
      input.workspaceDayExposureMicros,
      input.reservationMicros,
    );
  }

  const projectedGlobalDayMicros = addUsdMicros(
    input.globalDayExposureMicros,
    input.reservationMicros,
  );
  if (projectedGlobalDayMicros > caps.globalDay) {
    return exceeded(
      'global_day',
      caps.globalDay,
      input.globalDayExposureMicros,
      input.reservationMicros,
    );
  }

  return Object.freeze({
    status: 'ok',
    reservationMicros: input.reservationMicros,
    projectedWorkspaceDayMicros,
    projectedGlobalDayMicros,
  });
}
