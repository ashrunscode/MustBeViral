'use client';

import { useEffect } from 'react';
import { onCLS, onINP, onLCP, type Metric } from 'web-vitals';

import {
  createWebVitalMetric,
  reportWebVitalMetric,
  type WebVitalMetricName,
} from '../lib/telemetry/web-vitals';

function mapMetric(metric: Metric, name: WebVitalMetricName) {
  reportWebVitalMetric(
    createWebVitalMetric({
      name,
      value: metric.value,
      id: metric.id,
      navigationType: metric.navigationType ?? 'unknown',
    }),
  );
}

export function WebVitalsReporter() {
  useEffect(() => {
    onLCP((metric) => mapMetric(metric, 'LCP'));
    onINP((metric) => mapMetric(metric, 'INP'));
    onCLS((metric) => mapMetric(metric, 'CLS'));
  }, []);

  return null;
}
