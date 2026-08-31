export type WebVitalMetricName = 'LCP' | 'INP' | 'CLS';

export interface WebVitalMetric {
  readonly name: WebVitalMetricName;
  readonly value: number;
  readonly rating: 'good' | 'needs-improvement' | 'poor';
  readonly id: string;
  readonly navigationType: string;
  readonly recordedAt: string;
}

export type WebVitalReporter = (metric: WebVitalMetric) => void;

const globalReporterKey = '__mbvWebVitalReporter';

export function setWebVitalReporter(reporter: WebVitalReporter | null): void {
  if (typeof globalThis === 'undefined') return;
  Reflect.set(globalThis, globalReporterKey, reporter);
}

export function readWebVitalReporter(): WebVitalReporter | null {
  if (typeof globalThis === 'undefined') return null;
  const reporter = Reflect.get(globalThis, globalReporterKey);
  return typeof reporter === 'function' ? (reporter as WebVitalReporter) : null;
}

export function rateWebVital(name: WebVitalMetricName, value: number): WebVitalMetric['rating'] {
  if (name === 'LCP') {
    if (value <= 2500) return 'good';
    if (value <= 4000) return 'needs-improvement';
    return 'poor';
  }
  if (name === 'INP') {
    if (value <= 200) return 'good';
    if (value <= 500) return 'needs-improvement';
    return 'poor';
  }
  if (value <= 0.1) return 'good';
  if (value <= 0.25) return 'needs-improvement';
  return 'poor';
}

export function createWebVitalMetric(input: {
  readonly name: WebVitalMetricName;
  readonly value: number;
  readonly id: string;
  readonly navigationType: string;
}): WebVitalMetric {
  return Object.freeze({
    name: input.name,
    value: input.value,
    rating: rateWebVital(input.name, input.value),
    id: input.id,
    navigationType: input.navigationType,
    recordedAt: new Date().toISOString(),
  });
}

export function reportWebVitalMetric(metric: WebVitalMetric): void {
  readWebVitalReporter()?.(metric);
  if (process.env.NODE_ENV !== 'production') {
    console.info(
      JSON.stringify({
        level: 'info',
        event: 'web.vitals',
        metric: metric.name,
        value: metric.value,
        rating: metric.rating,
        navigation_type: metric.navigationType,
      }),
    );
  }
}
