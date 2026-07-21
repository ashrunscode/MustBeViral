import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GOLDEN_BRIEF_IDS,
  LAUNCH_PACK_SHAPE,
  buildGoldenLaunchPackGraph,
  launchPackShapeOf,
} from '@mustbeviral/contracts';

import goldenBriefMarkdown from '../../../../docs/research/GOLDEN_BRIEFS.md?raw';
import { parseGoldenBriefRegistry } from '../../tools/golden-brief-registry';
import {
  StagingLaunchPackTransport,
  createInMemoryHarnessTransport,
  executeGoldenBrief,
} from '../../tools/launch-pack-harness-lib';
import { authenticateDisposableStagingUser } from '../../tools/staging-auth';

describe('golden launch-pack harness', () => {
  beforeEach(() => {
    vi.stubEnv('STAGING_TEST_EMAIL', '');
    vi.stubEnv('STAGING_TEST_PASSWORD', '');
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('parses exactly the 20 registered briefs and preserves launch-pack shape invariants', async () => {
    const briefs = parseGoldenBriefRegistry(goldenBriefMarkdown);

    expect(briefs.map((brief) => brief.briefId)).toEqual(GOLDEN_BRIEF_IDS);
    expect(briefs).toHaveLength(20);
    for (const brief of briefs) {
      expect(Object.values(brief).every((value) => value.length > 0)).toBe(true);
      const graph = buildGoldenLaunchPackGraph(brief);
      expect(launchPackShapeOf(graph)).toEqual(LAUNCH_PACK_SHAPE);
      expect(new Set(graph.nodes.map((node) => node.id)).size).toBe(graph.nodes.length);
      expect(new Set(graph.edges.map((edge) => edge.id)).size).toBe(graph.edges.length);
    }
  });

  it('drives all briefs through shared handlers to named quotes and fail-closed confirmation', async () => {
    const briefs = parseGoldenBriefRegistry(goldenBriefMarkdown);
    const transport = createInMemoryHarnessTransport();
    const records = [];

    for (const brief of briefs) records.push(await executeGoldenBrief(brief, transport));

    expect(records).toHaveLength(20);
    expect(new Set(records.map((record) => record.workspace_id)).size).toBe(20);
    expect(records.map((record) => record.quote.total_micros)).toEqual(
      Array.from({ length: 20 }, () => '1595000'),
    );
    expect(records.every((record) => record.confirm_result === 'provider_unavailable')).toBe(true);
  });

  it('rejects resource input that the composed Supabase port would reject', async () => {
    const transport = createInMemoryHarnessTransport();
    const validContext = {
      workspace_id: '00000000-0000-4000-8000-000000000000',
      actor_id: 'golden-brief-harness',
      request_id: 'request-strictness-1',
    };

    await expect(
      transport.call('create_workspace', {
        name: 'Missing context',
        idempotency_key: 'strictness-1',
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
    await expect(
      transport.call('create_workspace', {
        context: validContext,
        name: 'Missing idempotency',
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
    await expect(
      transport.call('create_workspace', {
        context: { workspace_id: validContext.workspace_id, actor_id: validContext.actor_id },
        name: 'Missing request id',
        idempotency_key: 'strictness-3',
      }),
    ).rejects.toMatchObject({ name: 'ZodError' });
  });

  it('keeps the staging transport behind an injected fetch seam', async () => {
    const fetchImplementation = vi.fn(async () =>
      Response.json({
        data: { quote: { quoteId: 'quote-1' } },
        meta: { request_id: 'request-1' },
      }),
    );
    const transport = new StagingLaunchPackTransport(
      'https://core.example',
      'caller-token',
      fetchImplementation,
    );

    await expect(
      transport.call('quote_run', {
        context: { request_id: 'request-quote-1' },
        canvas_id: 'canvas-1',
        expected_revision_id: 'revision-1',
        idempotency_key: 'quote-key',
      }),
    ).resolves.toMatchObject({ ok: true });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://core.example/v1/canvases/canvas-1/quotes',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer caller-token',
          'idempotency-key': 'quote-key',
        }),
      }),
    );
  });

  it('polls disposable auth without logging or storing the password', async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ user: { id: 'pending' } }))
      .mockResolvedValueOnce(Response.json({ access_token: 'caller-token' }));
    const log = vi.fn<(message: string) => void>();

    const authenticated = await authenticateDisposableStagingUser({
      configuration: {
        supabaseUrl: 'https://project.supabase.co',
        publishableKey: 'public-key',
      },
      fetchImplementation,
      log,
      sleep: async () => undefined,
    });

    expect(authenticated.accessToken).toBe('caller-token');
    expect(authenticated.email).toContain('+launch-pack-');
    expect(log).toHaveBeenCalledWith(expect.stringContaining(`PAUSED`));
    const signupBody = String(fetchImplementation.mock.calls[0]?.[1]?.body);
    const password = (JSON.parse(signupBody) as { password: string }).password;
    expect(JSON.stringify(log.mock.calls)).not.toContain(password);
  });

  it('uses injected staging credentials without attempting signup', async () => {
    vi.stubEnv('STAGING_TEST_EMAIL', 'confirmed@example.com');
    vi.stubEnv('STAGING_TEST_PASSWORD', 'injected-password');
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ access_token: 'injected-caller-token' }));
    const log = vi.fn<(message: string) => void>();

    const authenticated = await authenticateDisposableStagingUser({
      configuration: {
        supabaseUrl: 'https://project.supabase.co',
        publishableKey: 'public-key',
      },
      fetchImplementation,
      log,
      sleep: async () => undefined,
    });

    expect(authenticated).toEqual({
      email: 'confirmed@example.com',
      accessToken: 'injected-caller-token',
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(
      'https://project.supabase.co/auth/v1/token?grant_type=password',
    );
    expect(log).not.toHaveBeenCalled();
  });
});
