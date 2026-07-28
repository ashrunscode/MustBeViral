import { describe, expect, it } from 'vitest';

import { usdMicros } from './money';
import { attemptRefundCausativeKey, deriveFalCaptureAmount, planRunSettlement } from './settlement';

describe('fal capture derivation', () => {
  it('uses pinned per-image price times verified artifact count', () => {
    expect(
      deriveFalCaptureAmount(
        { unit: 'image', unitPriceMicros: usdMicros(500_000n) },
        {
          kind: 'images',
          artifacts: [
            { widthPixels: 1024, heightPixels: 1024 },
            { widthPixels: 1080, heightPixels: 1350 },
          ],
        },
      ),
    ).toEqual({ measuredUnits: 2n, amountMicros: 1_000_000n });
  });

  it('uses pinned per-second price times ceiling of verified duration', () => {
    expect(
      deriveFalCaptureAmount(
        { unit: 'video_second', unitPriceMicros: usdMicros(100_000n) },
        { kind: 'video', durationMilliseconds: 8_001 },
      ),
    ).toEqual({ measuredUnits: 9n, amountMicros: 900_000n });
  });

  it('rejects catalog and measurement mismatches or unverified dimensions', () => {
    expect(() =>
      deriveFalCaptureAmount(
        { unit: 'image', unitPriceMicros: usdMicros(500_000n) },
        { kind: 'video', durationMilliseconds: 8_000 },
      ),
    ).toThrow('verified image artifacts');
    expect(() =>
      deriveFalCaptureAmount(
        { unit: 'image', unitPriceMicros: usdMicros(500_000n) },
        { kind: 'images', artifacts: [{ widthPixels: 0, heightPixels: 1024 }] },
      ),
    ).toThrow('positive safe integer');
  });
});

describe('per-attempt run settlement plan', () => {
  it('captures successful attempts and releases the exact zero-residual remainder', () => {
    const plan = planRunSettlement({
      runId: 'run-1',
      reservationMicros: usdMicros(1_000_000n),
      outcomes: [
        { attemptId: 'attempt-a', status: 'succeeded', captureMicros: usdMicros(250_000n) },
        { attemptId: 'attempt-b', status: 'failed' },
        { attemptId: 'attempt-c', status: 'succeeded', captureMicros: usdMicros(350_000n) },
      ],
    });

    expect(plan).toEqual({
      captures: [
        {
          attemptId: 'attempt-a',
          amountMicros: 250_000n,
          causativeKey: 'run:run-1:attempt:attempt-a:capture',
        },
        {
          attemptId: 'attempt-c',
          amountMicros: 350_000n,
          causativeKey: 'run:run-1:attempt:attempt-c:capture',
        },
      ],
      captureTotalMicros: 600_000n,
      releaseRemainderMicros: 400_000n,
      releaseCausativeKey: 'run:run-1:settlement:release',
    });
    expect(plan.captureTotalMicros + plan.releaseRemainderMicros).toBe(1_000_000n);
    expect(attemptRefundCausativeKey('run-1', 'attempt-a')).toBe(
      'run:run-1:attempt:attempt-a:refund',
    );
  });

  it('fails closed when captures exceed the reservation', () => {
    expect(() =>
      planRunSettlement({
        runId: 'run-1',
        reservationMicros: usdMicros(500_000n),
        outcomes: [
          { attemptId: 'attempt-a', status: 'succeeded', captureMicros: usdMicros(500_001n) },
        ],
      }),
    ).toThrow('exceed the reservation');
  });

  it('rejects duplicate attempt outcomes', () => {
    expect(() =>
      planRunSettlement({
        runId: 'run-1',
        reservationMicros: usdMicros(500_000n),
        outcomes: [
          { attemptId: 'attempt-a', status: 'failed' },
          { attemptId: 'attempt-a', status: 'canceled' },
        ],
      }),
    ).toThrow('Duplicate attempt');
  });
});
