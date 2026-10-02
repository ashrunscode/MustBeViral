'use client';
import { useState, type FormEvent } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { PlatformHeading, PlatformRecovery } from './platform-frame';
import { PlatformRequestError, platformMutationErrorMessage } from './platform-client';
import { usePlatformMutation } from './platform-mutation';

export function StudioSettings({
  studio,
  role,
  refresh,
}: Readonly<{
  studio: PlatformOutput<'get_studio'>['record'];
  role: string;
  refresh: () => void;
}>) {
  const mutation = usePlatformMutation();
  const [saved, setSaved] = useState(false);
  if (role !== 'owner')
    return (
      <PlatformRecovery error={new PlatformRequestError('FORBIDDEN', 'Owner access required')} />
    );
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const result = await mutation.mutate('update_studio', {
      studio_id: studio.id,
      name: String(values.get('name')).trim(),
      slug: studio.slug,
      expected_version: studio.version,
    });
    if (result) {
      setSaved(true);
      refresh();
    }
  }
  return (
    <>
      <PlatformHeading
        title="Studio settings."
        description="Name this shared space for the people who work here."
      />
      <form
        key={studio.version}
        className="platform-card platform-pad platform-stack"
        onSubmit={(e) => void save(e)}
      >
        <fieldset disabled={mutation.pending || studio.status !== 'active'}>
          <label>
            Studio name
            <input
              name="name"
              defaultValue={studio.name}
              required
              maxLength={120}
              onChange={() => setSaved(false)}
            />
          </label>
          <button
            className="platform-primary"
            type="submit"
            aria-busy={mutation.pending || undefined}
          >
            {mutation.pending ? 'Saving…' : 'Save studio name'}
          </button>
        </fieldset>
        {saved && mutation.error === undefined ? (
          <p role="status" className="platform-success">
            Studio name saved.
          </p>
        ) : null}
        {mutation.error !== undefined && (
          <div role="alert" className="platform-stack">
            <p className="platform-error">{platformMutationErrorMessage(mutation.error)}</p>
            <button type="button" onClick={refresh}>
              Reload the saved version
            </button>
          </div>
        )}
        <p className="platform-muted">
          Each workspace controls its own brand grants and billing. A studio name change preserves
          those boundaries.
        </p>
      </form>
    </>
  );
}
