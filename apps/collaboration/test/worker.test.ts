import { env, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { FORBIDDEN_COLLABORATION_ROUTES } from '@mustbeviral/collaboration';

describe('collaboration worker authority boundary', () => {
  it('exposes a health probe that declares draft-only authority', async () => {
    const response = await SELF.fetch('https://collaboration.test/health');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { authority: string; service: string };
    };
    expect(body.data.authority).toBe('draft-only');
    expect(body.data.service).toBe(env.SERVICE_NAME);
  });

  it.each(FORBIDDEN_COLLABORATION_ROUTES)(
    'does not expose revision, billing, or webhook routes at %s',
    async (route) => {
      const response = await SELF.fetch(`https://collaboration.test${route}`);
      expect(response.status).toBe(404);
    },
  );

  it('routes each canvas to an isolated coordination object via snapshot reads', async () => {
    const first = await SELF.fetch('https://collaboration.test/canvases/canvas-a/snapshot');
    const second = await SELF.fetch('https://collaboration.test/canvases/canvas-b/snapshot');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const firstBody = (await first.json()) as { data: { canvas_id: string } };
    const secondBody = (await second.json()) as { data: { canvas_id: string } };
    expect(firstBody.data.canvas_id).toBe('canvas-a');
    expect(secondBody.data.canvas_id).toBe('canvas-b');
  });
});
