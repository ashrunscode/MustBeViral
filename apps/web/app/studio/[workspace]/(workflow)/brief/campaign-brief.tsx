'use client';

import { Button, Chip, MonoCaps } from '@mustbeviral/ui';
import { useMemo, useState } from 'react';

import {
  BriefDraftSchema,
  InMemoryBriefDraftPort,
  lumenSkinDraft,
  type BriefDraft,
} from '../../../../../src/features/brief/brief-schema';
import styles from './campaign-brief.module.css';

type SectionId = 'productTruth' | 'brandKit' | 'audience' | 'offer' | 'claimsLegal' | 'assets';

const draftPort = new InMemoryBriefDraftPort();

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

function getCompletionChecks(draft: BriefDraft) {
  return [
    complete(draft.productTruth.productName) && complete(draft.productTruth.category),
    complete(draft.productTruth.features) && complete(draft.productTruth.benefits),
    complete(draft.productTruth.evidence) && complete(draft.productTruth.approvedFacts),
    complete(draft.brandKit.colors) && complete(draft.brandKit.typography),
    complete(draft.brandKit.tone) && complete(draft.brandKit.visualRules),
    complete(draft.brandKit.examples) && complete(draft.brandKit.prohibitedTreatments),
    complete(draft.audience.targetAudience) && complete(draft.audience.awarenessStage),
    complete(draft.audience.painPoints) && complete(draft.audience.desires),
    complete(draft.audience.objections),
    complete(draft.offer.pricePresentation) && complete(draft.offer.urgencyConstraints),
    /^https?:\/\//.test(draft.offer.destinationUrl),
    complete(draft.claimsLegal.approvedClaims),
    complete(draft.claimsLegal.evidenceSource),
    complete(draft.claimsLegal.legalCopy) && draft.claimsLegal.prohibitedClaims.length > 0,
    draft.assets.packshots.length > 0,
    draft.assets.squarePackshotReady,
    draft.assets.rightsAttested,
  ];
}

function getSectionState(section: SectionId, draft: BriefDraft) {
  if (section === 'claimsLegal') {
    const missing =
      [
        draft.claimsLegal.approvedClaims,
        draft.claimsLegal.evidenceSource,
        draft.claimsLegal.legalCopy,
      ].filter((value) => !complete(value)).length +
      (draft.claimsLegal.prohibitedClaims.length === 0 ? 1 : 0) +
      Number(!draft.assets.rightsAttested);
    return { complete: missing === 0, meta: missing === 0 ? 'Complete' : `${missing} missing` };
  }

  if (section === 'assets') {
    const ready = Math.min(
      5,
      draft.assets.packshots.length + Number(draft.assets.squarePackshotReady),
    );
    return { complete: ready >= 5, meta: ready >= 5 ? 'Complete' : `${ready} / 5 ready` };
  }

  return { complete: true, meta: 'Complete' };
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
  draft,
  section,
  setDraft,
}: Readonly<{
  draft: BriefDraft;
  section: SectionId;
  setDraft: (updater: (current: BriefDraft) => BriefDraft) => void;
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
                {asset}
              </Chip>
            ))}
          </div>
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
            I attest that Lumen Skin owns or is licensed to use all uploaded source assets and
            evidence. <span className={styles.required}>Required</span>
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
            : 'Add a source for “Dermatologist tested”.'
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
      <label className={`${styles.attestation} ${styles.full}`} htmlFor="rights-check">
        <input
          id="rights-check"
          type="checkbox"
          checked={draft.assets.rightsAttested}
          onChange={(event) => update('assets', 'rightsAttested', event.target.checked)}
        />
        <span>
          I attest that Lumen Skin owns or is licensed to use all uploaded packshots, logos,
          typography, testimonials, and supporting evidence.{' '}
          <span className={styles.required}>Required</span>
        </span>
      </label>
    </>
  );
}

export function CampaignBrief({ workspace }: Readonly<{ workspace: string }>) {
  const [draft, setDraftState] = useState<BriefDraft>(lumenSkinDraft);
  const [activeSection, setActiveSection] = useState<SectionId>('claimsLegal');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [validated, setValidated] = useState(false);
  const validation = useMemo(() => BriefDraftSchema.safeParse(draft), [draft]);
  const checks = getCompletionChecks(draft);
  const completed = checks.filter(Boolean).length;
  const completeness = Math.round((completed / checks.length) * 100);
  const missingItems = [
    !complete(draft.claimsLegal.evidenceSource)
      ? 'Evidence source for “Dermatologist tested”'
      : null,
    !draft.assets.rightsAttested ? 'Asset-rights attestation' : null,
    !draft.assets.squarePackshotReady ? 'One square product packshot' : null,
  ].filter((item): item is string => item !== null);

  const setDraft = (updater: (current: BriefDraft) => BriefDraft) => {
    setValidated(false);
    setSaveState('idle');
    setDraftState(updater);
  };

  async function saveDraft() {
    setSaveState('saving');
    await draftPort.save(workspace, draft);
    setSaveState('saved');
  }

  return (
    <>
      <main id="main-content" className={styles.main}>
        <nav className={styles.rail} aria-label="Brief sections">
          <h2>Brief sections</h2>
          <div className={styles.steps}>
            {sectionLabels.map((section, index) => {
              const active = section.id === activeSection;
              const state = getSectionState(section.id, draft);
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
            Lumen Skin / Step{' '}
            {sectionLabels.findIndex((section) => section.id === activeSection) + 1} of 6
          </MonoCaps>
          <h1 id="brief-title">
            {sectionLabels.find((section) => section.id === activeSection)?.label}
          </h1>
          <p className={styles.lede}>{sectionDescriptions[activeSection]}</p>
          <form className={styles.fieldGrid} onSubmit={(event) => event.preventDefault()}>
            <SectionFields draft={draft} section={activeSection} setDraft={setDraft} />
          </form>
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
        </aside>
      </main>

      <div className={styles.confirmBar}>
        <div className={styles.barEvidence}>
          <div>
            <MonoCaps>Campaign</MonoCaps>
            <span>Lumen Skin</span>
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
              saveState === 'saving' ? 'loading' : saveState === 'saved' ? 'success' : 'default'
            }
            loadingLabel="Saving"
            onClick={() => void saveDraft()}
          >
            {saveState === 'saved' ? 'Draft saved' : 'Save draft'}
          </Button>
          <Button
            variant="primary"
            disabled={!validation.success}
            feedback={validated ? 'success' : 'default'}
            onClick={() => setValidated(true)}
          >
            Validate brief
          </Button>
        </div>
      </div>

      <footer className={styles.footer}>
        <div>
          <MonoCaps>Autosave: 18ms</MonoCaps>
          <MonoCaps>
            Fields: {completed + 7} / {checks.length + 7}
          </MonoCaps>
          <MonoCaps>Region: us-east-1</MonoCaps>
        </div>
        <MonoCaps>v2.0.4-studio</MonoCaps>
      </footer>
    </>
  );
}
