'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import {
  SOURCE_CAPTURE_MAX_BYTES,
  SOURCE_DOCUMENT_TEXT_MAX_CHARS,
  classifyPublicHttpsUrl,
  sniffDocumentMediaType,
} from '@mustbeviral/contracts';
import { PlatformHeading, PlatformLoading, PlatformRecovery } from './platform-frame';
import {
  PlatformRequestError,
  platformErrorMessage,
  platformMutationErrorMessage,
} from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { usePlatformMutation } from './platform-mutation';
import { readWebPublicEnvironment } from '../../config/public-environment';
import { resolveBrowserCoreBaseUrl } from '../../lib/core/browser-client';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';

type Brand = PlatformOutput<'get_brand'>['record'];
type Candidate = PlatformOutput<'get_knowledge_draft'>['current_candidates'][number];
type Job = PlatformOutput<'get_source_job'>['record'];
type Question = PlatformOutput<'get_knowledge_review'>['current_questions'][number];

export function isDenied(error: unknown) {
  return (
    error instanceof PlatformRequestError &&
    (error.code === 'NOT_FOUND' || error.code === 'FORBIDDEN')
  );
}

export function advanceCursor(
  history: readonly (string | undefined)[],
  next: string,
): (string | undefined)[] {
  if (history[history.length - 1] === next) return [...history];
  return [...history, next];
}

export function retreatCursor(history: readonly (string | undefined)[]): (string | undefined)[] {
  return history.length > 1 ? history.slice(0, -1) : [...history];
}

function jobMessage(job: Job | null): string {
  if (!job) return 'No capture has been started for this brand.';
  if (job.status === 'capturing' || job.status === 'queued') return 'Capturing source…';
  if (job.status === 'awaiting_bytes') return 'Waiting for the document to finish uploading.';
  if (job.status === 'captured') return 'Source captured. Review the unapproved findings.';
  if (job.status === 'duplicate') return 'This file or page was already captured for this brand.';
  if (job.failure_code)
    return platformErrorMessage(new PlatformRequestError(job.failure_code, job.failure_code));
  if (job.status === 'rejected' || job.status === 'failed') return 'Capture did not finish.';
  return `Capture status: ${job.status}`;
}

function CandidateValue({ candidate }: Readonly<{ candidate: Candidate }>) {
  if (candidate.value_text === null)
    return (
      <p className="platform-muted" data-testid="candidate-value">
        Unknown — not supplied.
      </p>
    );
  if (candidate.field_key === 'canonical_url' && classifyPublicHttpsUrl(candidate.value_text).ok) {
    return (
      <p data-testid="candidate-value">
        <a href={candidate.value_text} rel="nofollow noopener noreferrer">
          {candidate.value_text}
        </a>
      </p>
    );
  }
  return <p data-testid="candidate-value">{candidate.value_text}</p>;
}

function currentCandidate(candidates: readonly Candidate[], selectedId: string | null) {
  return (
    candidates.find((item) => item.id === selectedId) ??
    candidates.find((item) => item.supersedes_id === selectedId) ??
    candidates[0] ??
    null
  );
}

export function BrandFindings({
  studioId,
  brand,
  canWrite,
  onAuthorityLost,
}: Readonly<{
  studioId: string;
  brand: Brand;
  canWrite: boolean;
  onAuthorityLost?: () => void;
}>) {
  const [candidateHistory, setCandidateHistory] = useState<(string | undefined)[]>([undefined]);
  const [sourceHistory, setSourceHistory] = useState<(string | undefined)[]>([undefined]);
  const [sessionJobId, setSessionJobId] = useState<string | null>(null);
  const candidateCursor = candidateHistory[candidateHistory.length - 1];
  const sourceCursor = sourceHistory[sourceHistory.length - 1];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [correctionExcerpt, setCorrectionExcerpt] = useState('');
  const [url, setUrl] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(undefined);
  const draftQuery = usePlatformQuery(
    'get_knowledge_draft',
    {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      limit: 50,
      ...(candidateCursor ? { cursor: candidateCursor } : {}),
    },
    true,
    true,
  );
  const sourcesQuery = usePlatformQuery(
    'list_brand_sources',
    {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      limit: 20,
      ...(sourceCursor ? { cursor: sourceCursor } : {}),
    },
    true,
    true,
  );
  const latestJob = usePlatformQuery(
    'list_latest_source_job',
    { workspace_id: brand.workspace_id, brand_id: brand.id },
    true,
    true,
  );
  const jobId = sessionJobId ?? latestJob.data?.record?.id ?? null;
  const liveJob = usePlatformQuery(
    'get_source_job',
    {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      job_id: jobId ?? brand.id,
    },
    jobId !== null,
    true,
  );
  const reviewQuery = usePlatformQuery(
    'get_knowledge_review',
    { workspace_id: brand.workspace_id, brand_id: brand.id },
    true,
    true,
  );
  const website = usePlatformMutation();
  const documentCapture = usePlatformMutation();
  const manual = usePlatformMutation();
  const correction = usePlatformMutation();
  const extract = usePlatformMutation();
  const propose = usePlatformMutation();
  const ask = usePlatformMutation();
  const answer = usePlatformMutation();
  const assertionCorrection = usePlatformMutation();
  const approve = usePlatformMutation();
  const pin = usePlatformMutation();
  const [selectedAssertionId, setSelectedAssertionId] = useState<string | null>(null);
  const [assertionText, setAssertionText] = useState('');
  const [assertionExcerpt, setAssertionExcerpt] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [pinKey, setPinKey] = useState('campaign-preview');
  const [pinGeneration, setPinGeneration] = useState(0);
  const candidates = draftQuery.data?.current_candidates ?? [];
  const sources = sourcesQuery.data?.items ?? [];

  const jobStatus = liveJob.data?.record.status;
  const refreshJob = liveJob.refresh;
  useEffect(() => {
    if (jobStatus !== 'capturing' && jobStatus !== 'queued' && jobStatus !== 'awaiting_bytes')
      return;
    const timer = window.setInterval(() => refreshJob(), 1000);
    return () => window.clearInterval(timer);
  }, [jobStatus, refreshJob]);

  const denied =
    isDenied(draftQuery.error) ||
    isDenied(sourcesQuery.error) ||
    isDenied(reviewQuery.error) ||
    isDenied(liveJob.error) ||
    isDenied(latestJob.error) ||
    isDenied(website.error) ||
    isDenied(documentCapture.error) ||
    isDenied(manual.error) ||
    isDenied(correction.error) ||
    isDenied(extract.error) ||
    isDenied(propose.error) ||
    isDenied(ask.error) ||
    isDenied(answer.error) ||
    isDenied(assertionCorrection.error) ||
    isDenied(approve.error) ||
    isDenied(pin.error) ||
    isDenied(uploadError);
  const notifiedDenial = useRef(false);
  useEffect(() => {
    if (!denied) {
      notifiedDenial.current = false;
      return;
    }
    if (notifiedDenial.current) return;
    notifiedDenial.current = true;
    onAuthorityLost?.();
  }, [denied, onAuthorityLost]);
  if (denied)
    return (
      <PlatformRecovery
        error={
          draftQuery.error ??
          sourcesQuery.error ??
          reviewQuery.error ??
          liveJob.error ??
          latestJob.error ??
          website.error ??
          documentCapture.error ??
          manual.error ??
          correction.error ??
          extract.error ??
          propose.error ??
          ask.error ??
          answer.error ??
          assertionCorrection.error ??
          approve.error ??
          pin.error ??
          uploadError
        }
      />
    );
  if (
    (draftQuery.loading && draftQuery.data === undefined) ||
    (sourcesQuery.loading && sourcesQuery.data === undefined) ||
    (reviewQuery.loading && reviewQuery.data === undefined)
  )
    return <PlatformLoading label="Loading brand findings…" />;
  if (draftQuery.error !== undefined)
    return <PlatformRecovery error={draftQuery.error} retry={draftQuery.refresh} />;
  if (sourcesQuery.error !== undefined)
    return <PlatformRecovery error={sourcesQuery.error} retry={sourcesQuery.refresh} />;
  if (reviewQuery.error !== undefined)
    return <PlatformRecovery error={reviewQuery.error} retry={reviewQuery.refresh} />;

  const job = liveJob.data?.record ?? null;
  const current = currentCandidate(candidates, selectedId);
  const mutationError =
    website.error ??
    documentCapture.error ??
    manual.error ??
    correction.error ??
    extract.error ??
    propose.error ??
    ask.error ??
    answer.error ??
    assertionCorrection.error ??
    approve.error ??
    pin.error ??
    uploadError;
  const busy =
    website.pending ||
    documentCapture.pending ||
    manual.pending ||
    correction.pending ||
    extract.pending ||
    propose.pending ||
    ask.pending ||
    answer.pending ||
    assertionCorrection.pending ||
    approve.pending ||
    pin.pending ||
    uploadBusy;
  const uncertain = (error: unknown) =>
    error !== undefined &&
    (!(error instanceof PlatformRequestError) || error.code === 'INTERNAL_ERROR');

  function resetPages() {
    setCandidateHistory([undefined]);
    setSourceHistory([undefined]);
    draftQuery.refresh();
    sourcesQuery.refresh();
    reviewQuery.refresh();
    latestJob.refresh();
  }

  async function captureWebsite(event: FormEvent) {
    event.preventDefault();
    const result = await website.mutate('start_website_capture', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      url: url.trim(),
    });
    if (result?.job) setSessionJobId(result.job.id);
    resetPages();
  }

  async function startManual() {
    const result = await manual.mutate('start_manual_knowledge_draft', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
    });
    if (result) resetPages();
  }

  async function uploadDocument(file: File) {
    if (uploadBusy) return;
    setUploadBusy(true);
    setUploadError(undefined);
    try {
      if (file.size <= 0) throw new PlatformRequestError('SOURCE_MALFORMED', 'SOURCE_MALFORMED');
      if (file.size > SOURCE_CAPTURE_MAX_BYTES)
        throw new PlatformRequestError('SOURCE_TOO_LARGE', 'SOURCE_TOO_LARGE');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const declared =
        file.type === 'text/markdown' || file.name.endsWith('.md')
          ? 'text/markdown'
          : file.type === 'text/html' || file.name.endsWith('.html')
            ? 'text/html'
            : 'text/plain';
      const sniff = sniffDocumentMediaType(bytes, declared);
      if (sniff === 'unsupported')
        throw new PlatformRequestError('SOURCE_UNSUPPORTED', 'SOURCE_UNSUPPORTED');
      if (sniff === 'malformed')
        throw new PlatformRequestError('SOURCE_MALFORMED', 'SOURCE_MALFORMED');
      const filename = file.name.slice(0, 200);
      if (bytes.byteLength <= SOURCE_DOCUMENT_TEXT_MAX_CHARS) {
        let text_content: string;
        try {
          text_content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          throw new PlatformRequestError('SOURCE_MALFORMED', 'SOURCE_MALFORMED');
        }
        const result = await documentCapture.mutate('start_document_capture', {
          workspace_id: brand.workspace_id,
          brand_id: brand.id,
          filename,
          media_type: sniff,
          text_content,
        });
        if (result?.job) setSessionJobId(result.job.id);
      } else {
        const started = await documentCapture.mutate('start_document_capture', {
          workspace_id: brand.workspace_id,
          brand_id: brand.id,
          filename,
          media_type: sniff,
        });
        if (!started?.job) return;
        setSessionJobId(started.job.id);
        const environment = readWebPublicEnvironment();
        const supabase = createBrowserSupabaseClient();
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new PlatformRequestError('UNAUTHENTICATED', 'Your session has ended.');
        const response = await fetch(
          `${resolveBrowserCoreBaseUrl(environment.NEXT_PUBLIC_CORE_API_URL, window.location.origin)}/v1/workspaces/${brand.workspace_id}/brands/${brand.id}/source-jobs/${started.job.id}/content`,
          {
            method: 'PUT',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': sniff,
              'x-source-filename': filename,
            },
            body: bytes,
          },
        );
        const payload: unknown = await response.json().catch(() => ({}));
        if (!response.ok) {
          const code =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error?: { code?: string } }).error?.code === 'string'
              ? (payload as { error: { code: string } }).error.code
              : 'SOURCE_UNREACHABLE';
          throw new PlatformRequestError(code, code);
        }
        const record =
          typeof payload === 'object' &&
          payload !== null &&
          'data' in payload &&
          typeof (payload as { data?: { job?: Job } }).data?.job?.id === 'string'
            ? (payload as { data: { job: Job } }).data.job
            : null;
        if (record) setSessionJobId(record.id);
        liveJob.refresh();
      }
      resetPages();
    } catch (error) {
      setUploadError(error);
    } finally {
      setUploadBusy(false);
    }
  }

  async function saveCorrection(event: FormEvent) {
    event.preventDefault();
    if (!current || !draftQuery.data?.record) return;
    const result = await correction.mutate('correct_knowledge_candidate', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      candidate_id: current.id,
      expected_version: draftQuery.data.record.version,
      value_text: correctionText.trim() === '' ? null : correctionText,
      excerpt: correctionExcerpt.trim() || 'Operator correction.',
    });
    if (!result) {
      draftQuery.refresh();
      return;
    }
    setCorrectionText('');
    setCorrectionExcerpt('');
    const next = result.current_candidates.find((item) => item.supersedes_id === current.id);
    if (next) setSelectedId(next.id);
    resetPages();
  }

  const capturedSourceId = job?.source_id ?? sources[0]?.id ?? null;
  const assertions = reviewQuery.data?.current_assertions ?? [];
  const proposals = reviewQuery.data?.current_proposals ?? [];
  const questions = reviewQuery.data?.current_questions ?? [];
  const selectedAssertion =
    assertions.find((item) => item.id === selectedAssertionId) ?? assertions[0] ?? null;
  const draftHash = reviewQuery.data?.draft_hash ?? null;
  const draftVersion = reviewQuery.data?.record?.version ?? draftQuery.data?.record?.version ?? null;
  const approvedVersion = reviewQuery.data?.approved_version ?? null;

  async function runExtract() {
    if (!capturedSourceId) return;
    await extract.mutate('extract_brand_knowledge', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      source_id: capturedSourceId,
    });
    resetPages();
  }

  async function runPropose() {
    await propose.mutate('propose_brand_knowledge', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
    });
    resetPages();
  }

  async function runAsk() {
    await ask.mutate('ask_brand_knowledge_questions', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
    });
    resetPages();
  }

  async function saveAssertion(event: FormEvent) {
    event.preventDefault();
    if (!selectedAssertion || draftVersion === null) return;
    await assertionCorrection.mutate('correct_brand_assertion', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      assertion_id: selectedAssertion.id,
      expected_version: draftVersion,
      value_text: assertionText.trim() === '' ? null : assertionText,
      excerpt: assertionExcerpt.trim() || 'Operator assertion correction.',
    });
    setAssertionText('');
    setAssertionExcerpt('');
    resetPages();
  }

  async function saveAnswer(question: Question) {
    if (draftVersion === null) return;
    const text = (questionAnswers[question.id] ?? '').trim();
    if (text.length === 0) return;
    await answer.mutate('answer_brand_knowledge_question', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      question_id: question.id,
      expected_version: draftVersion,
      answer_text: text,
    });
    resetPages();
  }

  async function runApprove() {
    if (draftVersion === null || !draftHash) return;
    await approve.mutate('approve_brand_version', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      expected_version: draftVersion,
      draft_hash: draftHash,
    });
    resetPages();
  }

  async function runPin() {
    if (!approvedVersion) return;
    const result = await pin.mutate('pin_brand_version', {
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      pin_key: pinKey.trim(),
      brand_version_id: approvedVersion.id,
    });
    if (result) setPinGeneration((value) => value + 1);
    resetPages();
  }

  return (
    <>
      <PlatformHeading
        title="Review the source. Keep the meaning."
        description="These findings are unapproved. They are not brand knowledge until you correct and later approve them."
      />
      <div className="platform-split">
        <section className="platform-stack">
          {canWrite ? (
            <form
              className="platform-card platform-pad platform-stack"
              onSubmit={(event) => void captureWebsite(event)}
            >
              <h2>Capture a source</h2>
              <p className="platform-note">
                HTTPS websites and text, Markdown, or HTML documents only. PDF and Word files are
                not supported. Images found on a page are not imported as campaign assets.
              </p>
              <fieldset disabled={busy}>
                <label>
                  Website
                  <input
                    type="url"
                    value={url}
                    maxLength={2048}
                    placeholder="https://example.com"
                    onChange={(event) => setUrl(event.target.value)}
                  />
                </label>
                <button className="platform-primary" type="submit">
                  {website.pending
                    ? 'Capturing…'
                    : uncertain(website.error)
                      ? 'Retry the same capture'
                      : 'Capture website'}
                </button>
              </fieldset>
              <label>
                Upload a text document
                <input
                  type="file"
                  accept=".txt,.md,.html,text/plain,text/markdown,text/html"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void uploadDocument(file);
                  }}
                />
              </label>
              <button type="button" disabled={busy} onClick={() => void startManual()}>
                Continue without a website
              </button>
            </form>
          ) : (
            <p className="platform-note">
              You can read these findings. Capturing requires a brand write grant.
            </p>
          )}
          <p
            role="status"
            aria-live="polite"
            className="platform-note"
            data-testid="source-job-status"
            data-status={job?.status ?? 'none'}
          >
            {jobMessage(job)}
          </p>
          {canWrite && capturedSourceId ? (
            <button
              type="button"
              disabled={busy}
              data-testid="extract-knowledge"
              onClick={() => void runExtract()}
            >
              {extract.pending ? 'Extracting…' : 'Extract typed findings'}
            </button>
          ) : null}
          {mutationError !== undefined && (
            <p role="alert">{platformMutationErrorMessage(mutationError)}</p>
          )}
          <div className="platform-card platform-pad platform-stack">
            <h2>Current findings</h2>
            {candidates.length === 0 ? (
              <p className="platform-muted">
                No findings yet. Capture a source or continue without a website.
              </p>
            ) : (
              <ul className="platform-stack">
                {candidates.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`candidate-${item.field_key}`}
                      data-candidate-id={item.id}
                      aria-current={current?.id === item.id ? 'true' : undefined}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {item.field_key.replaceAll('_', ' ')} · {item.status}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {candidateHistory.length > 1 ? (
              <button
                type="button"
                onClick={() => setCandidateHistory((history) => retreatCursor(history))}
              >
                Previous findings
              </button>
            ) : null}
            {draftQuery.data?.next_cursor ? (
              <button
                type="button"
                onClick={() =>
                  setCandidateHistory((history) =>
                    advanceCursor(
                      history,
                      draftQuery.data?.next_cursor ?? history[history.length - 1] ?? '',
                    ),
                  )
                }
              >
                Next findings
              </button>
            ) : null}
          </div>
        </section>
        <aside className="platform-stack">
          <div className="platform-card platform-pad platform-stack">
            <span className="platform-eyebrow">Unapproved draft</span>
            {current ? (
              <>
                <h2>{current.field_key.replaceAll('_', ' ')}</h2>
                <CandidateValue candidate={current} />
                <p className="platform-muted" data-testid="candidate-provenance">
                  Source {current.source_id} · {current.method} · captured {current.captured_at}
                </p>
                <p data-testid="candidate-excerpt">Excerpt: {current.excerpt}</p>
                {canWrite ? (
                  <form className="platform-stack" onSubmit={(event) => void saveCorrection(event)}>
                    <label>
                      Correct this finding
                      <textarea
                        value={correctionText}
                        maxLength={4000}
                        disabled={busy}
                        onChange={(event) => setCorrectionText(event.target.value)}
                      />
                    </label>
                    <label>
                      Why this correction
                      <input
                        value={correctionExcerpt}
                        maxLength={2000}
                        disabled={busy}
                        onChange={(event) => setCorrectionExcerpt(event.target.value)}
                      />
                    </label>
                    <button
                      className="platform-primary"
                      type="submit"
                      disabled={busy || !draftQuery.data?.record}
                    >
                      {correction.pending
                        ? 'Saving correction…'
                        : uncertain(correction.error)
                          ? 'Retry the same correction'
                          : 'Save correction'}
                    </button>
                    {draftQuery.data?.record ? (
                      <p className="platform-muted" data-testid="draft-version">
                        Draft version {draftQuery.data.record.version}
                      </p>
                    ) : null}
                  </form>
                ) : null}
              </>
            ) : (
              <p>Select a finding to inspect its source.</p>
            )}
          </div>
          <div className="platform-card platform-pad platform-stack">
            <h2>Captured sources</h2>
            {sources.length === 0 ? (
              <p className="platform-muted">No sources stored for this brand.</p>
            ) : (
              <ul>
                {sources.map((source) => (
                  <li key={source.id} data-testid={`source-${source.kind}-${source.method}`}>
                    {source.method} · {source.kind} · {source.captured_at}
                    {source.origin_url && classifyPublicHttpsUrl(source.origin_url).ok
                      ? ` · ${source.origin_url}`
                      : source.kind === 'document'
                        ? ` · ${source.media_type}`
                        : ''}
                  </li>
                ))}
              </ul>
            )}
            {sourceHistory.length > 1 ? (
              <button
                type="button"
                onClick={() => setSourceHistory((history) => retreatCursor(history))}
              >
                Previous sources
              </button>
            ) : null}
            {sourcesQuery.data?.next_cursor ? (
              <button
                type="button"
                onClick={() =>
                  setSourceHistory((history) =>
                    advanceCursor(
                      history,
                      sourcesQuery.data?.next_cursor ?? history[history.length - 1] ?? '',
                    ),
                  )
                }
              >
                Next sources
              </button>
            ) : null}
          </div>
          <div className="platform-card platform-pad platform-stack">
            <h2>Typed findings</h2>
            <p className="platform-note">
              Offerings, locations, facts, offers, language and visual candidates stay unapproved.
              Images are not reusable campaign assets.
            </p>
            {assertions.length === 0 ? (
              <p className="platform-muted">Extract a captured source to review typed findings.</p>
            ) : (
              <ul className="platform-stack">
                {assertions.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      data-testid={`assertion-${item.kind}`}
                      data-assertion-id={item.id}
                      aria-current={selectedAssertion?.id === item.id ? 'true' : undefined}
                      onClick={() => setSelectedAssertionId(item.id)}
                    >
                      {item.kind.replaceAll('_', ' ')} · {item.status}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedAssertion ? (
              <>
                <p data-testid="assertion-value">
                  {selectedAssertion.value_text ?? 'Unknown — not supplied.'}
                </p>
                <p className="platform-muted" data-testid="assertion-provenance">
                  Source {selectedAssertion.source_id} · {selectedAssertion.method} · captured{' '}
                  {selectedAssertion.captured_at}
                </p>
                {canWrite ? (
                  <form className="platform-stack" onSubmit={(event) => void saveAssertion(event)}>
                    <label>
                      Correct this assertion
                      <textarea
                        value={assertionText}
                        maxLength={4000}
                        disabled={busy}
                        onChange={(event) => setAssertionText(event.target.value)}
                      />
                    </label>
                    <label>
                      Why this assertion correction
                      <input
                        value={assertionExcerpt}
                        maxLength={2000}
                        disabled={busy}
                        onChange={(event) => setAssertionExcerpt(event.target.value)}
                      />
                    </label>
                    <button className="platform-primary" type="submit" disabled={busy}>
                      {assertionCorrection.pending ? 'Saving assertion…' : 'Save assertion'}
                    </button>
                  </form>
                ) : null}
              </>
            ) : null}
            {canWrite ? (
              <button type="button" disabled={busy} onClick={() => void runPropose()}>
                {propose.pending ? 'Proposing…' : 'Propose voice, audience and positioning'}
              </button>
            ) : null}
            <ul className="platform-stack" data-testid="proposal-list">
              {proposals.map((item) => (
                <li key={item.id} data-testid={`proposal-${item.kind}`}>
                  {item.kind} · {item.status}
                  {item.confidence ? ` · ${item.confidence}` : ''} ·{' '}
                  {item.value_text ?? 'Unknown — not supplied.'}
                </li>
              ))}
            </ul>
            {canWrite ? (
              <button type="button" disabled={busy} onClick={() => void runAsk()}>
                {ask.pending ? 'Preparing questions…' : 'Ask targeted questions'}
              </button>
            ) : null}
            <ul className="platform-stack" data-testid="question-list">
              {questions.map((item) => (
                <li key={item.id} data-testid={`question-${item.target_kind}`}>
                  <p>{item.prompt}</p>
                  {item.status === 'answered' ? (
                    <p className="platform-muted">{item.answer_text}</p>
                  ) : canWrite ? (
                    <form
                      className="platform-stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveAnswer(item);
                      }}
                    >
                      <label>
                        Answer
                        <input
                          value={questionAnswers[item.id] ?? ''}
                          maxLength={4000}
                          disabled={busy}
                          onChange={(event) =>
                            setQuestionAnswers((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button type="submit" disabled={busy}>
                        Save answer
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {draftHash ? (
              <p className="platform-muted" data-testid="draft-hash">
                Draft hash {draftHash}
              </p>
            ) : null}
            {canWrite && draftHash && draftVersion !== null ? (
              <button
                className="platform-primary"
                type="button"
                disabled={busy}
                data-testid="approve-brand-version"
                onClick={() => void runApprove()}
              >
                {approve.pending ? 'Approving…' : 'Approve this exact draft'}
              </button>
            ) : null}
            {approvedVersion ? (
              <p data-testid="approved-version">
                Approved version {approvedVersion.version} · {approvedVersion.draft_hash}
              </p>
            ) : (
              <p className="platform-muted">No owner-approved brand version yet.</p>
            )}
            {canWrite && approvedVersion ? (
              <form
                className="platform-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runPin();
                }}
              >
                <label>
                  Campaign pin
                  <input
                    value={pinKey}
                    maxLength={120}
                    disabled={busy}
                    onChange={(event) => setPinKey(event.target.value)}
                  />
                </label>
                <button type="submit" disabled={busy} data-testid="pin-brand-version">
                  {pin.pending ? 'Pinning…' : 'Pin approved version'}
                </button>
              </form>
            ) : null}
            <PinnedVersion
              key={`${pinKey}-${pinGeneration}`}
              workspaceId={brand.workspace_id}
              brandId={brand.id}
              pinKey={pinKey}
              enabled={Boolean(approvedVersion)}
            />
          </div>
        </aside>
      </div>
      <p className="platform-muted">{studioId ? 'Findings stay on this brand.' : null}</p>
    </>
  );
}

function PinnedVersion({
  workspaceId,
  brandId,
  pinKey,
  enabled,
}: Readonly<{
  workspaceId: string;
  brandId: string;
  pinKey: string;
  enabled: boolean;
}>) {
  const query = usePlatformQuery(
    'get_brand_version_pin',
    { workspace_id: workspaceId, brand_id: brandId, pin_key: pinKey },
    enabled && pinKey.length > 0,
    true,
  );
  if (!enabled) return null;
  if (query.loading && query.data === undefined)
    return <p className="platform-muted">Checking campaign pin…</p>;
  if (query.error instanceof PlatformRequestError && query.error.code === 'NOT_FOUND')
    return <p className="platform-muted">No pin stored for this campaign key.</p>;
  if (query.error !== undefined) return <p role="alert">{platformErrorMessage(query.error)}</p>;
  const snapshot = query.data?.brand_version.snapshot.assertions ?? [];
  return (
    <div data-testid="pinned-version">
      <p>
        Pinned version {query.data?.brand_version.version} · {query.data?.brand_version.draft_hash}
      </p>
      <ul>
        {snapshot.map((item) => (
          <li key={item.id}>
            {item.kind} · {item.value_text ?? 'Unknown — not supplied.'}
          </li>
        ))}
      </ul>
    </div>
  );
}
