import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  RunProgress,
  RunResultNotice,
} from '../../../app/studio/[workspace]/(workflow)/quote/run-progress';
import { InMemoryRunPort } from './run-port';

describe('RunProgress', () => {
  it('renders queued and running attempts with work-motion markers', () => {
    const html = renderToStaticMarkup(
      <RunProgress workspace="lumen-skin" port={new InMemoryRunPort()} />,
    );
    expect(html).toContain('data-run-state="running"');
    expect(html).toContain('filament-sweep');
    expect(html).toContain('Queued');
    expect(html).toContain('Cancel run');
  });

  it.each([
    [{ type: 'conflict', actual_state: 'reviewable' } as const, 'data-result="conflict"'],
    [{ type: 'not_found', run_id: 'missing' } as const, 'data-result="not_found"'],
    [{ type: 'forbidden' } as const, 'data-result="forbidden"'],
    [
      { type: 'error', message: 'Core unavailable', retryable: true } as const,
      'data-result="error"',
    ],
  ])('renders result branch', (result, marker) => {
    expect(renderToStaticMarkup(<RunResultNotice result={result} />)).toContain(marker);
  });

  it.each([
    [
      () => {
        const port = new InMemoryRunPort();
        port.advance('run-lumen-0007', 0);
        return port;
      },
      'data-run-state="reviewable"',
      'First reviewable output is ready',
    ],
    [
      () => {
        const port = new InMemoryRunPort('failed');
        port.advance('run-lumen-0007', 0);
        port.advance('run-lumen-0007', 1);
        return port;
      },
      'data-run-state="failed"',
      'Image blocked by content policy',
    ],
    [
      () => {
        const port = new InMemoryRunPort();
        port.cancel('run-lumen-0007', 0);
        return port;
      },
      'data-run-state="cancelled"',
      'Run cancelled',
    ],
    [
      () => {
        const port = new InMemoryRunPort();
        port.advance('run-lumen-0007', 0);
        port.advance('run-lumen-0007', 1);
        port.advance('run-lumen-0007', 2);
        return port;
      },
      'data-run-state="complete"',
      'Open output review',
    ],
  ])('renders terminal and partial state presentation', (createPort, marker, copy) => {
    const html = renderToStaticMarkup(<RunProgress workspace="lumen-skin" port={createPort()} />);
    expect(html).toContain(marker);
    expect(html).toContain(copy);
  });

  it('names content-policy recovery without exposing provider payloads', () => {
    const port = new InMemoryRunPort('failed');
    port.advance('run-lumen-0007', 0);
    port.advance('run-lumen-0007', 1);
    const html = renderToStaticMarkup(<RunProgress workspace="lumen-skin" port={port} />);
    expect(html).toContain('data-recovery="content_policy_violation"');
    expect(html).toContain('This launch pack stopped');
    expect(html).toContain('Do not resubmit the same prompt');
    expect(html).toContain('Edit campaign brief');
    expect(html).not.toMatch(/fal\.|payload|signed url/iu);
  });
});
