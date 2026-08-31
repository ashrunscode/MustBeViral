import { describe, expect, it, vi } from 'vitest';

import {
  createWebVitalMetric,
  rateWebVital,
  reportWebVitalMetric,
  setWebVitalReporter,
} from './web-vitals';

describe('web-vitals telemetry', () => {
  it('rates LCP, INP, and CLS against production thresholds', () => {
    expect(rateWebVital('LCP', 2400)).toBe('good');
    expect(rateWebVital('LCP', 3000)).toBe('needs-improvement');
    expect(rateWebVital('INP', 180)).toBe('good');
    expect(rateWebVital('INP', 300)).toBe('needs-improvement');
    expect(rateWebVital('CLS', 0.08)).toBe('good');
    expect(rateWebVital('CLS', 0.2)).toBe('needs-improvement');
  });

  it('forwards metrics to the configured reporter', () => {
    const reporter = vi.fn();
    setWebVitalReporter(reporter);
    const metric = createWebVitalMetric({
      name: 'LCP',
      value: 1800,
      id: 'v1',
      navigationType: 'navigate',
    });
    reportWebVitalMetric(metric);
    expect(reporter).toHaveBeenCalledWith(metric);
    setWebVitalReporter(null);
  });
});
