'use client';

import { Button, Chip, MonoCaps } from '@mustbeviral/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { buildGoldenLaunchPackGraph } from '@mustbeviral/contracts';

import { SessionExpiredAction } from '../../../../../src/components/session-expired-action';

import {
  BriefDraftSchema,
  BriefDraftStorageError,
  InMemoryBriefDraftPort,
  SessionStorageBriefDraftPort,
  briefCompletionFlags,
  briefSectionState,
  firstIncompleteBriefSection,
  isUploadedPackshotRef,
  stagingWorkerDraft,
  launchPackBriefFromDraft,
  lumenSkinDraft,
  missingBriefItems,
  type BriefDraft,
  type BriefDraftPort,
  type BriefSectionId,
} from '../../../../../src/features/brief/brief-schema';
import {
  WorkerBriefBootstrapPort,
  type BriefBootstrapPort,
  type BriefBootstrapResult,
} from '../../../../../src/features/brief/brief-bootstrap';
import {
  PackshotUploadError,
  uploadPackshot,
} from '../../../../../src/features/brief/packshot-upload';
import { createBrowserCoreClient } from '../../../../../src/lib/core/browser-client';
import styles from './campaign-brief.module.css';

type SectionId = BriefSectionId;

const previewDraftPort = new InMemoryBriefDraftPort();

const sectionLabels: ReadonlyArray<Readonly<{ id: SectionId; label: string }>> = [
  { id: 'productTruth', label: 'Product truth' },
  { id: 'brandKit', label: 'Brand kit' },
  { id: 'audience', label: 'Audience' },
  { id: 'offer', label: 'Offer' },
  { id: 'claimsLegal', label: 'Claims & legal' },
  { id: 'assets', label: 'Assets' },
];

const sectionDescriptions: Readonly<Record<SectionId, string>> = {
  productTruth: 'Record only supported product facts that concepts and copy may use.',
  brandKit: 'Define the identity, tone, and visual boundaries every artifact must preserve.',
  audience: 'Describe the buyer context the campaign must recognize without inventing intent.',
  offer: 'Pin price presentation, urgency boundaries, and destination metadata before planning.',
  claimsLegal:
    'Define the approved facts and boundaries the launch pack may use. Generated copy will use only supplied or explicitly approved claims.',
  assets: 'Confirm the launch pack has the required source media and documented usage rights.',
};

function complete(value: string) {
  return value.trim().length > 0;
}

function TextField({
  error,
  id,
  label,
  onChange,
  value,
}: Readonly<{
  error?: string | undefined;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}>) {
  const errorId = `${id}-error`;
  return (
    <div className={`${styles.field} ${error ? styles.hasError : ''}`}>
      <label htmlFor={id}>
        {label} <span className={styles.required}>*</span>
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <div id={errorId} className={styles.errorMessage} role="alert">
          <span aria-hidden="true">!</span>
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function SectionFields({
  dataMode,
  draft,
  onUploadPackshot,
  section,
  setDraft,
  uploadBusy,
  uploadMessage,
}: Readonly<{
  dataMode: 'preview' | 'worker';
  draft: BriefDraft;
  onUploadPackshot?: (file: File) => Promise<void>;
  section: SectionId;
  setDraft: (updater: (current: BriefDraft) => BriefDraft) => void;
  uploadBusy?: boolean;
  uploadMessage?: string | null;
}>) {
  const update = <Key extends SectionId, Field extends keyof BriefDraft[Key]>(
    key: Key,
    field: Field,
    value: BriefDraft[Key][Field],
  ) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  };

  if (section === 'productTruth')
    return (
      <>
        <TextField
          id="product-name"
          label="Product name"
          value={draft.productTruth.productName}
          onChange={(value) => update('productTruth', 'productName', value)}
        />
        <TextField
          id="category"
          label="Category"
          value={draft.productTruth.category}
          onChange={(value) => update('productTruth', 'category', value)}
        />
        <TextField
          id="features"
          label="Features"
          value={draft.productTruth.features}
          onChange={(value) => update('productTruth', 'features', value)}
        />
        <TextField
          id="benefits"
          label="Supported benefits"
          value={draft.productTruth.benefits}
          onChange={(value) => update('productTruth', 'benefits', value)}
        />
        <TextField
          id="product-evidence"
          label="Evidence"
          value={draft.productTruth.evidence}
          onChange={(value) => update('productTruth', 'evidence', value)}
        />
        <TextField
          id="approved-facts"
          label="Approved facts"
          value={draft.productTruth.approvedFacts}
          onChange={(value) => update('productTruth', 'approvedFacts', value)}
        />
      </>
    );

  if (section === 'brandKit')
    return (
      <>
        <TextField
          id="colors"
          label="Colors"
          value={draft.brandKit.colors}
          onChange={(value) => update('brandKit', 'colors', value)}
        />
        <TextField
          id="typography"
          label="Typography"
          value={draft.brandKit.typography}
          onChange={(value) => update('brandKit', 'typography', value)}
        />
        <TextField
          id="tone"
          label="Tone"
          value={draft.brandKit.tone}
          onChange={(value) => update('brandKit', 'tone', value)}
        />
        <TextField
          id="visual-rules"
          label="Visual rules"
          value={draft.brandKit.visualRules}
          onChange={(value) => update('brandKit', 'visualRules', value)}
        />
        <TextField
          id="brand-examples"
          label="Examples"
          value={draft.brandKit.examples}
          onChange={(value) => update('brandKit', 'examples', value)}
        />
        <TextField
          id="prohibited-treatments"
          label="Prohibited treatments"
          value={draft.brandKit.prohibitedTreatments}
          onChange={(value) => update('brandKit', 'prohibitedTreatments', value)}
        />
      </>
    );

  if (section === 'audience')
    return (
      <>
        <TextField
          id="target-audience"
          label="Target audience"
          value={draft.audience.targetAudience}
          onChange={(value) => update('audience', 'targetAudience', value)}
        />
        <TextField
          id="awareness-stage"
          label="Awareness stage"
          value={draft.audience.awarenessStage}
          onChange={(value) => update('audience', 'awarenessStage', value)}
        />
        <TextField
          id="pain-points"
          label="Pain points"
          value={draft.audience.painPoints}
          onChange={(value) => update('audience', 'painPoints', value)}
        />
        <TextField
          id="desires"
          label="Desires"
          value={draft.audience.desires}
          onChange={(value) => update('audience', 'desires', value)}
        />
        <div className={styles.full}>
          <TextField
            id="objections"
            label="Objections"
            value={draft.audience.objections}
            onChange={(value) => update('audience', 'objections', value)}
          />
        </div>
      </>
    );

  if (section === 'offer')
    return (
      <>
        <TextField
          id="price-presentation"
          label="Price presentation"
          value={draft.offer.pricePresentation}
          onChange={(value) => update('offer', 'pricePresentation', value)}
        />
        <TextField
          id="urgency-constraints"
          label="Urgency constraints"
          value={draft.offer.urgencyConstraints}
          onChange={(value) => update('offer', 'urgencyConstraints', value)}
        />
        <div className={styles.full}>
          <TextField
            id="destination-url"
            label="Destination URL metadata"
            value={draft.offer.destinationUrl}
            onChange={(value) => update('offer', 'destinationUrl', value)}
          />
        </div>
      </>
    );

  if (section === 'assets')
    return (
      <>
        <div className={styles.full}>
          <label>Uploaded product packshots</label>
          <div className={styles.chipList}>
            {draft.assets.packshots.map((asset) => (
              <Chip key={asset} status="verified">
                {isUploadedPackshotRef(asset) ? 'Uploaded packshot' : asset}
              </Chip>
            ))}
          </div>
          {dataMode === 'worker' ? (
            <label className={styles.field} htmlFor="packshot-file">
              Attach a JPEG, PNG, or WebP packshot
              <input
                id="packshot-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadBusy === true}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void onUploadPackshot?.(file);
                }}
              />
              {uploadMessage ? (
                <div className={styles.errorMessage} role="alert">
                  <span>{uploadMessage}</span>
                </div>
              ) : null}
            </label>
          ) : null}
        </div>
        <label className={`${styles.attestation} ${styles.full}`} htmlFor="square-packshot">
          <input
            id="square-packshot"
            type="checkbox"
            checked={draft.assets.squarePackshotReady}
            onChange={(event) => update('assets', 'squarePackshotReady', event.target.checked)}
          />
          <span>
            One square product packshot is uploaded and ready for adaptation.{' '}
            <span className={styles.required}>Required</span>
          </span>
        </label>
        <label className={`${styles.attestation} ${styles.full}`} htmlFor="asset-rights">
          <input
            id="asset-rights"
            type="checkbox"
            checked={draft.assets.rightsAttested}
            onChange={(event) => update('assets', 'rightsAttested', event.target.checked)}
          />
          <span>
            I attest that {dataMode === 'preview' ? 'Lumen Skin' : 'this workspace'} owns or is
            licensed to use all uploaded source assets and evidence.{' '}
            <span className={styles.required}>Required</span>
          </span>
        </label>
      </>
    );

  return (
    <>
      <div className={styles.full}>
        <TextField
          id="approved-claims"
          label="Approved factual claims"
          value={draft.claimsLegal.approvedClaims}
          onChange={(value) => update('claimsLegal', 'approvedClaims', value)}
        />
        <div className={styles.explainer}>
          <MonoCaps>Why this matters</MonoCaps>
          <br />
          These statements become the factual boundary for concept, copy, and QA. Evidence is
          preserved with revision 7f3a.
        </div>
      </div>
      <TextField
        error={
          complete(draft.claimsLegal.evidenceSource)
            ? undefined
            : dataMode === 'preview'
              ? 'Add a source for “Dermatologist tested”.'
              : 'Add a source for every approved claim.'
        }
        id="evidence-source"
        label="Evidence source"
        value={draft.claimsLegal.evidenceSource}
        onChange={(value) => update('claimsLegal', 'evidenceSource', value)}
      />
      <TextField
        id="legal-copy"
        label="Required legal copy"
        value={draft.claimsLegal.legalCopy}
        onChange={(value) => update('claimsLegal', 'legalCopy', value)}
      />
      {dataMode === 'worker' ? (
        <>
          <TextField
            id="prohibited-claims"
            label="Prohibited claims"
            value={draft.claimsLegal.prohibitedClaims.join('\n')}
            onChange={(value) =>
              update(
                'claimsLegal',
                'prohibitedClaims',
                value
                  .split(/\n/u)
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0),
              )
            }
          />
          <TextField
            id="creative-constraints"
            label="Creative constraints"
            value={draft.claimsLegal.creativeConstraints}
            onChange={(value) => update('claimsLegal', 'creativeConstraints', value)}
          />
        </>
      ) : (
        <fieldset className={`${styles.fieldset} ${styles.full}`}>
          <legend>Prohibited claims</legend>
          <div className={styles.chipList} aria-label="Prohibited claim list">
            {draft.claimsLegal.prohibitedClaims.map((claim) => (
              <Chip key={claim} icon="×" status="failed">
                {claim}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}
      <label className={`${styles.attestation} ${styles.full}`} htmlFor="rights-check">
        <input
          id="rights-check"
          type="checkbox"
          checked={draft.assets.rightsAttested}
          onChange={(event) => update('assets', 'rightsAttested', event.target.checked)}
        />
        <span>
          I attest that {dataMode === 'preview' ? 'Lumen Skin' : 'this workspace'} owns or is
          licensed to use all uploaded packshots, logos, typography, testimonials, and supporting
          evidence. <span className={styles.required}>Required</span>
        </span>
      </label>
    </>
  );
}

export function CampaignBrief({
  bootstrapPort: suppliedBootstrapPort,
  dataMode = 'preview',
  draftPort: suppliedDraftPort,
  subject,
  workspace,
}: Readonly<{
  bootstrapPort?: BriefBootstrapPort;
  dataMode?: 'preview' | 'worker';
  draftPort?: BriefDraftPort;
  subject: string;
  workspace: string;
}>) {
  const router = useRouter();
  const [bootstrapPort] = useState<BriefBootstrapPort | null>(() =>
    dataMode === 'worker'
      ? (suppliedBootstrapPort ?? new WorkerBriefBootstrapPort(createBrowserCoreClient()))
      : null,
  );
  const [draftPort] = useState<BriefDraftPort>(
    () =>
      suppliedDraftPort ??
      (dataMode === 'preview' ? previewDraftPort : new SessionStorageBriefDraftPort(subject)),
  );
  const [draft, setDraftState] = useState<BriefDraft>(
    dataMode === 'preview' ? lumenSkinDraft : stagingWorkerDraft(),
  );
  const [activeSection, setActiveSection] = useState<SectionId>(
    dataMode === 'preview' ? 'claimsLegal' : 'productTruth',
  );
  const [draftLoadState, setDraftLoadState] = useState<'loading' | 'ready' | 'error'>(
    dataMode === 'preview' ? 'ready' : 'loading',
  );
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [validated, setValidated] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<BriefBootstrapResult | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const validation = useMemo(() => BriefDraftSchema.safeParse(draft), [draft]);
  const missingItems = missingBriefItems(draft);
  const flags = briefCompletionFlags(draft);
  const completeness = Math.round((flags.filter(Boolean).length / flags.length) * 100);

  useEffect(() => {
    if (dataMode === 'preview') return;
    let active = true;
    void draftPort
      .load(workspace)
      .then((savedDraft) => {
        if (!active) return;
        if (savedDraft !== null) {
          setDraftState(savedDraft);
          setActiveSection(firstIncompleteBriefSection(savedDraft) ?? 'productTruth');
          setSaveState('saved');
        }
        setDraftLoadState('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setDraftLoadState('error');
        setDraftMessage(
          error instanceof BriefDraftStorageError
            ? error.message
            : 'The saved browser-session draft could not be restored.',
        );
      });
    return () => {
      active = false;
    };
  }, [dataMode, draftPort, workspace]);

  const setDraft = (updater: (current: BriefDraft) => BriefDraft) => {
    setValidated(false);
    setSaveState('idle');
    setDraftState(updater);
  };

  async function saveDraft() {
    setSaveState('saving');
    setDraftMessage(null);
    try {
      await draftPort.save(workspace, draft);
      setSaveState('saved');
    } catch (error) {
      setSaveState('error');
      setDraftMessage(
        error instanceof BriefDraftStorageError
          ? error.message
          : 'The draft could not be saved in this browser session.',
      );
    }
  }

  async function discardUnreadableDraft() {
    try {
      await draftPort.clear(workspace);
      setDraftState(stagingWorkerDraft());
      setActiveSection('productTruth');
      setSaveState('idle');
      setDraftMessage(null);
      setDraftLoadState('ready');
    } catch (error) {
      setDraftMessage(
        error instanceof BriefDraftStorageError
          ? error.message
          : 'The saved browser-session draft could not be cleared.',
      );
    }
  }

  async function validateBrief() {
    if (!validation.success) return;
    if (bootstrapPort === null) {
      setValidated(true);
      return;
    }
    setBootstrapping(true);
    setBootstrapResult(null);
    const next = await bootstrapPort.bootstrap({
      workspaceRef: workspace,
      campaignName: `${draft.productTruth.productName} launch pack`,
      graph: buildGoldenLaunchPackGraph(launchPackBriefFromDraft(draft)),
    });
    setBootstrapResult(next);
    setBootstrapping(false);
    if (next.type !== 'ok') return;
    try {
      await draftPort.clear(workspace);
      setSaveState('idle');
    } catch (error) {
      setSaveState('error');
      setDraftMessage(
        error instanceof BriefDraftStorageError
          ? error.message
          : 'The completed session draft could not be cleared from this browser.',
      );
    }
    setValidated(true);
    router.push(
      `/studio/${encodeURIComponent(next.workspaceId)}/canvas?canvas=${encodeURIComponent(next.canvasId)}`,
    );
  }

  async function handleUploadPackshot(file: File) {
    if (bootstrapPort === null) return;
    setUploadBusy(true);
    setUploadMessage(null);
    try {
      let projectId = bootstrapResult?.type === 'ok' ? bootstrapResult.projectId : undefined;
      if (projectId === undefined) {
        const ready = await bootstrapPort.bootstrap({
          workspaceRef: workspace,
          campaignName: `${draft.productTruth.productName.trim() || 'Campaign'} launch pack`,
        });
        setBootstrapResult(ready);
        if (ready.type !== 'ok') {
          if (ready.type !== 'session_expired') {
            setUploadMessage('Create the campaign project before attaching a packshot.');
          }
          return;
        }
        projectId = ready.projectId;
      }
      const uploaded = await uploadPackshot(createBrowserCoreClient(), projectId, file);
      if (uploaded.type === 'session_expired') {
        setBootstrapResult(uploaded);
        return;
      }
      setDraft((current) => ({
        ...current,
        assets: {
          ...current.assets,
          packshots: [
            ...current.assets.packshots.filter((item) => !isUploadedPackshotRef(item)),
            `uploaded:${uploaded.artifactId}`,
          ],
          squarePackshotReady: true,
        },
      }));
    } catch (error) {
      setUploadMessage(
        error instanceof PackshotUploadError
          ? error.message
          : 'The packshot could not be stored privately.',
      );
    } finally {
      setUploadBusy(false);
    }
  }

  const bootstrapMessage =
    bootstrapResult === null ||
    bootstrapResult.type === 'ok' ||
    bootstrapResult.type === 'session_expired'
      ? null
      : bootstrapResult.type === 'forbidden'
        ? 'Your session is not permitted to bootstrap this workspace.'
        : bootstrapResult.message;

  return (
    <>
      <main id="main-content" className={styles.main}>
        <nav className={styles.rail} aria-label="Brief sections">
          <h2>Brief sections</h2>
          <div className={styles.steps}>
            {sectionLabels.map((section, index) => {
              const active = section.id === activeSection;
              const state = briefSectionState(section.id, draft);
              const sectionDone = state.complete;
              const meta = state.meta;
              return (
                <button
                  key={section.id}
                  type="button"
                  className={`${styles.step} ${active ? styles.active : ''} ${sectionDone ? styles.done : ''}`}
                  onClick={() => setActiveSection(section.id)}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className={styles.stepIcon} aria-hidden="true">
                    {sectionDone ? '✓' : index + 1}
                  </span>
                  <span>
                    {section.label}
                    <MonoCaps className={styles.stepMeta}>{meta}</MonoCaps>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <section className={styles.formField} aria-labelledby="brief-title">
          <MonoCaps className={styles.eyebrow}>
            {dataMode === 'preview'
              ? 'Lumen Skin'
              : draft.productTruth.productName.trim() || 'Campaign'}{' '}
            / Step {sectionLabels.findIndex((section) => section.id === activeSection) + 1} of 6
          </MonoCaps>
          <h1 id="brief-title">
            {sectionLabels.find((section) => section.id === activeSection)?.label}
          </h1>
          <p className={styles.lede}>{sectionDescriptions[activeSection]}</p>
          {draftLoadState === 'loading' ? (
            <div className={styles.errorMessage} role="status">
              <span>Restoring this browser-session draft…</span>
            </div>
          ) : draftLoadState === 'error' ? (
            <div className={styles.errorMessage} role="alert">
              <span>{draftMessage}</span>
              <Button variant="ghost" onClick={() => void discardUnreadableDraft()}>
                Start a new session draft
              </Button>
            </div>
          ) : (
            <form className={styles.fieldGrid} onSubmit={(event) => event.preventDefault()}>
              <SectionFields
                dataMode={dataMode}
                draft={draft}
                onUploadPackshot={handleUploadPackshot}
                section={activeSection}
                setDraft={setDraft}
                uploadBusy={uploadBusy}
                uploadMessage={uploadMessage}
              />
            </form>
          )}
        </section>

        <aside className={styles.summary} aria-labelledby="summary-title">
          <h2 id="summary-title">Brief summary</h2>
          <div className={styles.meterRow}>
            <MonoCaps>Brief completeness</MonoCaps>
            <MonoCaps className={styles.meterValue}>{completeness}%</MonoCaps>
          </div>
          <div
            className={styles.meter}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completeness}
            aria-label="Brief completeness"
          >
            <div className={styles.meterFill} style={{ width: `${completeness}%` }} />
          </div>
          <div className={styles.missing}>
            <h3>{missingItems.length > 0 ? 'Missing items' : 'Ready to validate'}</h3>
            {missingItems.length > 0 ? (
              <ul>
                {missingItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <Chip status="verified">All required inputs ready</Chip>
            )}
          </div>
          <div className={styles.summaryNote} aria-live="polite">
            <MonoCaps>
              {validation.success
                ? validated
                  ? 'Brief validated'
                  : 'Ready for validation'
                : 'Execution blocked'}
            </MonoCaps>
            <br />
            {validation.success
              ? 'The brief meets the required field, rights, and asset gates.'
              : 'Validation and planning remain unavailable until all required fields and rights attestations pass.'}
          </div>
          {bootstrapMessage === null ? null : (
            <div className={styles.errorMessage} role="alert" data-result={bootstrapResult?.type}>
              <span aria-hidden="true">!</span>
              <span>{bootstrapMessage}</span>
            </div>
          )}
          {bootstrapResult?.type === 'session_expired' ? (
            <SessionExpiredAction className={styles.errorMessage} />
          ) : null}
          {draftMessage === null || draftLoadState === 'error' ? null : (
            <div className={styles.errorMessage} role="alert">
              <span aria-hidden="true">!</span>
              <span>{draftMessage}</span>
            </div>
          )}
        </aside>
      </main>

      <div className={styles.confirmBar}>
        <div className={styles.barEvidence}>
          <div>
            <MonoCaps>Campaign</MonoCaps>
            <span>
              {dataMode === 'preview'
                ? 'Lumen Skin'
                : draft.productTruth.productName.trim() || 'Untitled campaign'}
            </span>
          </div>
          <div>
            <MonoCaps>Revision</MonoCaps>
            <MonoCaps>7f3a draft</MonoCaps>
          </div>
          <div>
            <MonoCaps>Required</MonoCaps>
            <MonoCaps>{missingItems.length} items missing</MonoCaps>
          </div>
        </div>
        <div className={styles.actions}>
          <Button
            className={styles.saveDraft}
            variant="ghost"
            feedback={
              saveState === 'saving'
                ? 'loading'
                : saveState === 'saved'
                  ? 'success'
                  : saveState === 'error'
                    ? 'error'
                    : 'default'
            }
            disabled={draftLoadState !== 'ready'}
            loadingLabel="Saving"
            onClick={() => void saveDraft()}
          >
            {saveState === 'saved'
              ? dataMode === 'preview'
                ? 'Draft saved'
                : 'Saved for this session'
              : 'Save draft'}
          </Button>
          <Button
            variant="primary"
            disabled={
              draftLoadState !== 'ready' ||
              !validation.success ||
              bootstrapping ||
              bootstrapResult?.type === 'session_expired'
            }
            feedback={
              bootstrapping
                ? 'loading'
                : validated
                  ? 'success'
                  : bootstrapMessage === null
                    ? 'default'
                    : 'error'
            }
            loadingLabel="Opening canvas"
            onClick={() => void validateBrief()}
          >
            Validate brief
          </Button>
        </div>
      </div>

      <footer className={styles.footer}>
        <div>
          <MonoCaps>
            {dataMode === 'preview'
              ? 'Autosave: 18ms'
              : `Session draft: ${
                  draftLoadState === 'loading'
                    ? 'loading'
                    : saveState === 'saving'
                      ? 'saving'
                      : saveState === 'saved'
                        ? 'saved'
                        : saveState === 'error' || draftLoadState === 'error'
                          ? 'error'
                          : 'not saved'
                }`}
          </MonoCaps>
          <MonoCaps>
            Fields: {flags.filter(Boolean).length + 7} / {flags.length + 7}
          </MonoCaps>
          <MonoCaps>Region: us-east-1</MonoCaps>
        </div>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </>
  );
}
