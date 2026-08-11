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
  percentileNearestRank,
  safeGoldenPackCount,
  summarizeGolden20Records,
  type Golden20BriefRecord,
} from '../../tools/golden-20-staging-harness';
import {
  StagingLaunchPackTransport,
  createInMemoryHarnessTransport,
  executeGoldenBrief,
  prepareGoldenBrief,
  startPreparedGoldenBrief,
} from '../../tools/launch-pack-harness-lib';
import {
  authenticateDisposableStagingUser,
  createConfirmedDisposableStagingUser,
  selectStagingPrivilegedKey,
} from '../../tools/staging-auth';
import {
  PACK_QUOTE_MICROS,
  SELF_SESSION_BRIEF_IDS,
  WALLET_CREDIT_MICROS,
  briefBootstrapKey,
  credentialsDocument,
  stableBriefSegment,
} from '../../tools/self-session-kit';

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
      Array.from({ length: 20 }, () => '4550000'),
    );
    expect(records.every((record) => record.confirm_result === 'provider_unavailable')).toBe(true);
  });

  it('preserves the authoritative run and reservation identifiers after confirmed start', async () => {
    const brief = parseGoldenBriefRegistry(goldenBriefMarkdown)[0];
    if (brief === undefined) throw new Error('golden brief fixture missing');
    const transport = createInMemoryHarnessTransport({ providerResult: 'succeeded' });
    const prepared = await prepareGoldenBrief(brief, transport);

    await expect(startPreparedGoldenBrief(prepared, transport, false)).resolves.toMatchObject({
      confirm_result: 'started',
      run_id: 'run-1',
      reservation_id: 'reservation-1',
      initial_status: 'queued',
    });
  });

  it('reserves operator headroom and computes nearest-rank acceptance latency honestly', () => {
    expect(
      safeGoldenPackCount({
        observed_at: '2026-08-11T12:00:00Z',
        utc_day_start: '2026-08-11T00:00:00Z',
        global_daily_cap_micros: '100000000',
        global_exposure_micros: '4550000',
        global_remaining_micros: '95450000',
        reservation_count: 1,
        unsettled_reservation_count: 0,
        status_counts: { captured: 1 },
      }),
    ).toBe(15);
    expect(percentileNearestRank([100, 200, 300, 400], 0.5)).toBe(200);
    expect(percentileNearestRank([100, 200, 300, 400], 0.9)).toBe(400);

    const records: Golden20BriefRecord[] = Array.from({ length: 20 }, (_, index) => {
      const completed = index < 15;
      return completed
        ? {
            brief_id: `GB-${String(index + 1).padStart(2, '0')}`,
            outcome: 'completed',
            quote: {
              quote_id: `quote-${String(index)}`,
              quoted_micros: '4550000',
              expires_at: 'x',
            },
            run: {
              run_id: `run-${String(index)}`,
              reservation_id: `reservation-${String(index)}`,
              status: 'succeeded',
              time_to_first_reviewable_ms: 300_000,
            },
            money: {
              reserved_micros: '4550000',
              captured_micros: '4550000',
              released_micros: '0',
              refunded_micros: '0',
              residual_micros: '0',
              capture_ledger_micros: '4550000',
              catalog_landed_cost_micros: '4550000',
              external_provider_cost_micros: null,
              external_provider_cost_observability: 'not_observable',
            },
            providers: {
              jobs: 16,
              unique_attempts: 16,
              duplicate_attempts: 0,
              all_terminal_succeeded: true,
              routes: [],
            },
            artifacts: {
              customer_reads: 17,
              approved_outputs: 16,
              exports: 1,
              all_available: true,
              all_private_exact_key: true,
              all_content_addressed: true,
              export_content_hash: 'a'.repeat(64),
              export_byte_size: 1,
            },
            receipt: {
              customer_path_read: true,
              ledger_capture_rows: 16,
              ledger_artifact_links_complete: true,
              lineage_rows: 30,
              export_member_rows: 16,
              provider_model_cost_complete: true,
            },
          }
        : { brief_id: `GB-${String(index + 1).padStart(2, '0')}`, outcome: 'cap_deferred' };
    });
    const summary = summarizeGolden20Records(records);
    expect(summary['completed']).toBe(15);
    expect((summary['acceptance'] as Record<string, unknown>)['at_least_16_of_20_complete']).toBe(
      false,
    );
    const first = records[0];
    if (first?.quote === undefined || first.money === undefined || first.run === undefined) {
      throw new Error('completed summary fixture missing');
    }
    const duplicateSummary = summarizeGolden20Records(records, [
      { brief_id: 'GB-01', quote: first.quote, money: first.money, run: first.run },
    ]);
    expect(duplicateSummary['paid_attempts']).toBe(16);
    expect(
      (duplicateSummary['acceptance'] as Record<string, unknown>)[
        'zero_duplicate_submissions_or_unexplained_ledger_differences'
      ],
    ).toBe(false);
    expect(
      (duplicateSummary['acceptance'] as Record<string, unknown>)[
        'completed_runs_have_private_artifacts_lineage_and_receipts'
      ],
    ).toBe(true);
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

  it('confirms a caller-held disposable identity without logging either credential', async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 'u' }));
    const identity = { email: 'disposable@example.test', password: 'transient-password' };

    await expect(
      createConfirmedDisposableStagingUser({
        configuration: {
          supabaseUrl: 'https://project.supabase.co',
          publishableKey: 'public-key',
          serviceRoleKey: 'service-role-key',
        },
        identity,
        fetchImplementation,
      }),
    ).resolves.toBe('u');

    const request = fetchImplementation.mock.calls[0];
    expect(request?.[0]).toBe('https://project.supabase.co/auth/v1/admin/users');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({
      email: identity.email,
      password: identity.password,
      email_confirm: true,
    });
  });

  it('prefers the modern staging secret while retaining the legacy service-role fallback', () => {
    const assignment = (name: string, value: string) => `${name}=${value}\n`;
    const source =
      assignment('SUPABASE_SECRET_KEY', 'file-modern') +
      assignment('SUPABASE_SERVICE_ROLE_KEY', 'file-legacy');

    expect(selectStagingPrivilegedKey(source, { SUPABASE_SECRET_KEY: 'env-modern' })).toBe(
      'env-modern',
    );
    expect(selectStagingPrivilegedKey(source, { SUPABASE_SERVICE_ROLE_KEY: 'env-legacy' })).toBe(
      'env-legacy',
    );
    expect(selectStagingPrivilegedKey(source, {})).toBe('file-modern');
    expect(
      selectStagingPrivilegedKey(assignment('SUPABASE_SERVICE_ROLE_KEY', 'file-legacy'), {}),
    ).toBe('file-legacy');
  });

  it('pins the ignored operator kit to five exact packs and the Brief screen idempotency scheme', () => {
    expect(WALLET_CREDIT_MICROS).toBe(PACK_QUOTE_MICROS * 5n);
    expect(SELF_SESSION_BRIEF_IDS).toEqual(['GB-02', 'GB-04', 'GB-10']);
    expect(stableBriefSegment('Northstar Magnesium launch pack')).toBe(
      'northstar-magnesium-launch-pack',
    );
    expect(briefBootstrapKey('project', 'workspace-Northstar Magnesium launch pack')).toBe(
      'web-brief-project-workspace-northstar-magnesium-launch-pack',
    );

    const document = credentialsDocument(
      { email: 'operator@example.test', password: 'local-secret' },
      {
        userId: 'user-1',
        workspaceId: 'workspace-1',
        seededBriefs: [
          {
            briefId: 'GB-02',
            product: 'Northstar Magnesium',
            projectId: 'project-1',
            canvasId: 'canvas-1',
            revisionId: 'revision-1',
          },
        ],
      },
    );
    expect(document).toContain('operator@example.test');
    expect(document).toContain('local-secret');
    expect(document).toContain('22,750,000 micros');
    expect(document).toContain('Two packs per day');
    expect(document).toContain('/studio/workspace-1/canvas?canvas=canvas-1');
  });
});
