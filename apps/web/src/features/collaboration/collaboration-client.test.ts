import { describe, expect, it } from 'vitest';

import { collaborationWebSocketUrl } from '@mustbeviral/collaboration';

describe('collaboration web client wiring', () => {
  it('targets the collaboration worker websocket route per canvas', () => {
    expect(collaborationWebSocketUrl('http://127.0.0.1:8788', 'canvas-42')).toBe(
      'ws://127.0.0.1:8788/canvases/canvas-42/ws',
    );
  });
});
