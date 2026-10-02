import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import {
  BlockedRunNotice,
  QuoteResultNotice,
} from '../../../app/studio/[workspace]/(workflow)/quote/quote-flow';
import { WorkerRunStartPort } from '../run/run-port';
import { WorkerQuotePort, createGoldenQuote } from './quote-port';

const workspace = '22222222-2222-4222-8222-222222222222';
const studio = '11111111-1111-4111-8111-111111111111';

function clientAnswering(status: number, error: Readonly<Record<string, unknown>>) {
  return createMustBeViralRestClient({
    baseUrl: 'https://api.example.test',
    getAccessToken: async () => 'session-token',
    createRequestId: () => 'request-blocked-0001',
    fetch: async () =>
      new Response(JSON.stringify({ error: { request_id: 'request-blocked-0001', ...error } }), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  });
}

describe('kill switches and billing blocks are named, not generic outages', () => {
  it('maps a 402 BILLING_BLOCKED confirm to billing_blocked with its reason', async () => {
    const port = new WorkerRunStartPort(
      clientAnswering(402, {
        code: 'BILLING_BLOCKED',
        message: 'Charging is turned off, so no run can be started.',
        retryable: false,
        details: { reason: 'charging_disabled' },
      }),
      () => 'start-idem-blocked',
    );
    const quote = { ...createGoldenQuote(1_000), id: 'quote-blocked' };
    await expect(port.confirm({ quote, acknowledged: true, nowMs: 2_000 })).resolves.toEqual({
      type: 'billing_blocked',
      reason: 'charging_disabled',
      message: 'Charging is turned off, so no run can be started.',
    });
  });

  it('maps a 503 MODEL_UNAVAILABLE confirm to provider_unavailable with the switch named', async () => {
    const port = new WorkerRunStartPort(
      clientAnswering(503, {
        code: 'MODEL_UNAVAILABLE',
        message: 'Provider-backed execution is not enabled.',
        retryable: false,
        details: { reason: 'provider_runs_disabled' },
      }),
      () => 'start-idem-switch',
    );
    const quote = { ...createGoldenQuote(1_000), id: 'quote-switch' };
    await expect(port.confirm({ quote, acknowledged: true, nowMs: 2_000 })).resolves.toEqual({
      type: 'provider_unavailable',
      reason: 'provider_runs_disabled',
      message: 'Provider-backed execution is not enabled.',
    });
  });

  it('maps a blocked quote read the same way', async () => {
    const port = new WorkerQuotePort(
      clientAnswering(402, {
        code: 'BILLING_BLOCKED',
        message: 'The subscription is not active, so no run can be started.',
        retryable: false,
        details: { reason: 'subscription_inactive' },
      }),
      'canvas-1',
      'rev-1',
      () => 'quote-idem',
    );
    await expect(port.read()).resolves.toEqual({
      type: 'billing_blocked',
      reason: 'subscription_inactive',
      message: 'The subscription is not active, so no run can be started.',
    });
  });

  it('renders the billing block with its cause, no charge, and the billing link', () => {
    const html = renderToStaticMarkup(
      <QuoteResultNotice
        context={{ studio }}
        result={{
          type: 'billing_blocked',
          reason: 'charging_disabled',
          message: 'Charging is turned off, so no run can be started.',
        }}
        workspace={workspace}
      />,
    );
    expect(html).toContain('data-result="billing_blocked"');
    expect(html).toContain('Charging is turned off');
    expect(html).toContain('Nothing was charged');
    expect(html).toContain(`/studio/${workspace}/billing?studio=${studio}`);
    expect(html).not.toContain('outage');
  });

  it('renders the provider switch as a setting, not an outage, with the plan kept', () => {
    const html = renderToStaticMarkup(
      <QuoteResultNotice
        result={{
          type: 'provider_unavailable',
          reason: 'provider_runs_disabled',
          message: 'Provider-backed execution is not enabled.',
        }}
        workspace={workspace}
      />,
    );
    expect(html).toContain('data-result="provider_unavailable"');
    expect(html).toContain('Runs are turned off right now');
    expect(html).toContain('a setting, not an outage');
    expect(html).toContain('Your plan and this quote are saved');
    expect(html).not.toContain('Open workspace billing');
  });

  it('never claims a saved quote when the quote itself was refused', () => {
    const html = renderToStaticMarkup(
      <BlockedRunNotice
        context={{}}
        stage="read"
        result={{
          type: 'billing_blocked',
          reason: 'charging_disabled',
          message: 'Charging is turned off, so no run can be started.',
        }}
        workspace={workspace}
      />,
    );
    expect(html).toContain('No quote was created');
    expect(html).toContain('Your plan is saved');
    expect(html).not.toContain('this quote are saved');
  });
});
