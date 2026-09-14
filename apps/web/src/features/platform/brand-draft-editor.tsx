'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { PlatformInput, PlatformOutput } from '@mustbeviral/contracts';
import { PlatformHeading, PlatformLoading, PlatformRecovery } from './platform-frame';
import { platformMutationErrorMessage, PlatformRequestError } from './platform-client';
import { usePlatformQuery } from './use-platform-query';
import { usePlatformMutation } from './platform-mutation';
import { attachUnsavedGuards, UNSAVED_LEAVE_MESSAGE } from './unsaved-navigation';

type Brand = PlatformOutput<'get_brand'>['record'];
type Draft = NonNullable<PlatformOutput<'get_brand_draft'>['record']>;
type Fields = Pick<
  PlatformInput<'save_brand_draft'>,
  'website_url' | 'description' | 'audience' | 'goals' | 'current_step'
>;
function fieldsOf(draft: Draft): Fields {
  const { website_url, description, audience, goals, current_step } = draft;
  return { website_url, description, audience, goals, current_step };
}
export function BrandDraftEditor({
  studioId,
  brand,
  canWrite,
  onDirty,
}: Readonly<{
  studioId: string;
  brand: Brand;
  canWrite: boolean;
  onDirty: (dirty: boolean) => void;
}>) {
  const query = usePlatformQuery('get_brand_draft', {
    workspace_id: brand.workspace_id,
    brand_id: brand.id,
  });
  const mutation = usePlatformMutation();
  if (query.loading) return <PlatformLoading label="Loading your saved draft…" />;
  if (query.error !== undefined || !query.data)
    return <PlatformRecovery error={query.error} retry={query.refresh} />;
  if (query.data.record === null)
    return (
      <section className="platform-card platform-pad platform-stack">
        <h1>Start {brand.name}’s saved draft.</h1>
        <p>This existing brand has no onboarding draft yet.</p>
        {canWrite && (
          <button
            disabled={mutation.pending}
            className="platform-primary"
            onClick={() => {
              void mutation
                .mutate('initialize_brand_draft', {
                  studio_id: studioId,
                  workspace_id: brand.workspace_id,
                  brand_id: brand.id,
                })
                .then((result) => {
                  if (result) query.refresh();
                });
            }}
          >
            Start a brand draft
          </button>
        )}
        {mutation.error !== undefined && (
          <p role="alert">{platformMutationErrorMessage(mutation.error)}</p>
        )}
      </section>
    );
  return (
    <DraftForm
      key={query.data.record.id}
      initial={query.data.record}
      brandName={brand.name}
      canWrite={canWrite}
      onDirty={onDirty}
      reload={query.refresh}
    />
  );
}
function DraftForm({
  initial,
  brandName,
  canWrite,
  onDirty,
  reload,
}: Readonly<{
  initial: Draft;
  brandName: string;
  canWrite: boolean;
  onDirty: (dirty: boolean) => void;
  reload: () => void;
}>) {
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(initial));
  const mutation = usePlatformMutation();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const dirty = JSON.stringify(fields) !== JSON.stringify(fieldsOf(saved));
  const denied =
    mutation.error instanceof PlatformRequestError &&
    ['NOT_FOUND', 'FORBIDDEN', 'RESOURCE_ARCHIVED'].includes(mutation.error.code);
  const uncertain =
    mutation.error !== undefined &&
    (!(mutation.error instanceof PlatformRequestError) || mutation.error.code === 'INTERNAL_ERROR');
  useEffect(() => {
    onDirty(dirty || mutation.pending);
    return () => onDirty(false);
  }, [dirty, mutation.pending, onDirty]);
  useEffect(
    () =>
      attachUnsavedGuards({
        dirty: dirty || mutation.pending,
        confirmLeave: () => window.confirm(UNSAVED_LEAVE_MESSAGE),
        target: window,
      }),
    [dirty, mutation.pending],
  );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await mutation.mutate('save_brand_draft', {
      workspace_id: saved.workspace_id,
      brand_id: saved.brand_id,
      expected_version: saved.version,
      ...fields,
    });
    if (mounted.current && result) setSaved(result.record);
  }
  if (denied) return <PlatformRecovery error={mutation.error} retry={reload} />;
  return (
    <>
      <PlatformHeading
        title={`Make ${brandName} feel like itself.`}
        description="Save what you know now. Add sources and review the details as your brand takes shape."
      />
      <div className="platform-split">
        <form className="platform-card platform-pad platform-stack" onSubmit={(e) => void save(e)}>
          <div className="platform-row platform-between">
            <h2 id="brand-essentials-heading">Brand essentials</h2>
            <span className="platform-tag" role="status" aria-live="polite">
              {mutation.pending
                ? 'Saving…'
                : dirty
                  ? 'Unsaved changes'
                  : `Saved · version ${saved.version}`}
            </span>
          </div>
          <fieldset
            disabled={!canWrite || mutation.pending}
            aria-labelledby="brand-essentials-heading"
          >
            <label>
              Website{' '}
              <span className="platform-muted">Optional — you can enter details manually.</span>
              <input
                type="url"
                value={fields.website_url}
                maxLength={2048}
                readOnly={uncertain}
                onChange={(e) => setFields({ ...fields, website_url: e.target.value })}
                placeholder="https://yourbrand.com"
              />
            </label>
            <label>
              What should we know?
              <textarea
                value={fields.description}
                maxLength={2000}
                readOnly={uncertain}
                onChange={(e) => setFields({ ...fields, description: e.target.value })}
                placeholder="What you do, where you work, and the details that make this brand different."
              />
            </label>
            <label>
              Who are you trying to reach?
              <textarea
                value={fields.audience}
                maxLength={2000}
                readOnly={uncertain}
                onChange={(e) => setFields({ ...fields, audience: e.target.value })}
                placeholder="Describe your customers in your own words."
              />
            </label>
            <label>
              What would you like to achieve?
              <textarea
                value={fields.goals}
                maxLength={2000}
                readOnly={uncertain}
                onChange={(e) => setFields({ ...fields, goals: e.target.value })}
                placeholder="The next useful outcome for this brand."
              />
            </label>
            <label>
              Where should we resume?
              <select
                value={fields.current_step}
                disabled={uncertain}
                onChange={(e) =>
                  setFields({ ...fields, current_step: e.target.value as Fields['current_step'] })
                }
              >
                <option value="identity">Brand essentials</option>
                <option value="details">Audience and goals</option>
                <option value="review">Ready for source review</option>
              </select>
            </label>
            <button
              type="submit"
              className="platform-primary"
              disabled={!dirty && mutation.error === undefined}
            >
              {mutation.pending
                ? 'Saving draft…'
                : uncertain
                  ? 'Retry the same save'
                  : 'Save draft'}
            </button>
          </fieldset>
          {mutation.error !== undefined && (
            <div role="alert" className="platform-note platform-error">
              <p>{platformMutationErrorMessage(mutation.error)}</p>
              {mutation.error instanceof PlatformRequestError &&
                mutation.error.code === 'REVISION_CONFLICT' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          'Discard your unsaved edits and load the current saved version?',
                        )
                      )
                        reload();
                    }}
                  >
                    Discard edits and reload
                  </button>
                )}
            </div>
          )}
          {!canWrite && (
            <p className="platform-note">
              You can read this draft. Editing requires a current brand write grant.
            </p>
          )}
        </form>
        <aside className="platform-stack">
          <div className="platform-card platform-pad platform-stack">
            <span className="platform-eyebrow">A brand you can reuse</span>
            <h2>Keep the meaning. Keep the source.</h2>
            <p>
              These details are your input. They have not been extracted from a website or approved
              as a brand version.
            </p>
            <div className="platform-note">
              Entering a website here saves its address only. Capture and review findings on the
              Findings tab. Nothing here is approved brand knowledge.
            </div>
            <p className="platform-muted">
              Original assets, rights and source review will attach to this brand as those workflows
              become available.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
