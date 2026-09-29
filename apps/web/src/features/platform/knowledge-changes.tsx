'use client';
import { useState, type FormEvent } from 'react';
import {
  KnowledgeExpiryInputSchema,
  knowledgeExpiryInstant,
  type PlatformOutput,
} from '@mustbeviral/contracts';

type View = PlatformOutput<'get_brand_knowledge_changes'>;
type Assertion = View['groups'][number]['current_assertions'][number];
export function expiryReached(expiry: string | null, evaluatedAt: string) {
  if (expiry === null) return false;
  const instant = knowledgeExpiryInstant(expiry);
  const evaluated = knowledgeExpiryInstant(evaluatedAt);
  return instant !== null && evaluated !== null && instant <= evaluated;
}
export type LifecycleReview = {
  value_text: string | null;
  ends_at: string | null;
  excerpt: string;
} & (
  | { operation: 'review_expired_offer'; assertion_id: string }
  | { operation: 'resolve_brand_contradiction'; kind: Assertion['kind']; field_key: string }
);

function ReviewForm({
  offer,
  label,
  busy,
  onSave,
}: Readonly<{
  offer: boolean;
  label: string;
  busy: boolean;
  onSave: (value: {
    value_text: string | null;
    ends_at: string | null;
    excerpt: string;
  }) => Promise<void>;
}>) {
  const [mode, setMode] = useState('');
  const [value, setValue] = useState('');
  const [expiry, setExpiry] = useState('');
  const [reason, setReason] = useState('');
  const badExpiry =
    mode === 'replace' &&
    offer &&
    expiry.length > 0 &&
    !KnowledgeExpiryInputSchema.safeParse(expiry.trim()).success;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!mode || badExpiry || !reason.trim() || (mode === 'replace' && !value.trim())) return;
    await onSave({
      value_text: mode === 'withdraw' ? null : value,
      ends_at: mode === 'replace' && offer && expiry.trim() ? expiry.trim() : null,
      excerpt: reason.trim(),
    });
  }
  return (
    <form className="platform-stack" onSubmit={(event) => void save(event)}>
      <fieldset disabled={busy}>
        <legend>{label}</legend>
        <label>
          Review decision
          <select value={mode} onChange={(event) => setMode(event.target.value)} required>
            <option value="">Choose a decision</option>
            <option value="replace">Use a reviewed value</option>
            <option value="withdraw">Withdraw from future content</option>
          </select>
        </label>
        {mode === 'replace' ? (
          <>
            <label>
              Reviewed value
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                maxLength={4000}
                required
              />
            </label>
            {offer ? (
              <label>
                Reviewed expiry with timezone
                <input
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  placeholder="2098-01-01T18:00:00-06:00"
                  aria-invalid={badExpiry}
                />
              </label>
            ) : null}
            {offer ? (
              <p className="platform-note">
                An expired offer needs a verified future date and time with Z or a timezone offset.
                Otherwise withdraw it.
              </p>
            ) : null}
          </>
        ) : null}
        <label>
          Reason for this review
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            required
          />
        </label>
        <button type="submit" disabled={!mode || badExpiry}>
          {busy ? 'Recording review…' : `Record ${label.toLowerCase()}`}
        </button>
      </fieldset>
    </form>
  );
}

function Evidence({
  title,
  assertions,
}: Readonly<{ title: string; assertions: readonly Assertion[] }>) {
  return (
    <div className="platform-stack">
      <h4>{title}</h4>
      {assertions.length === 0 ? (
        <p className="platform-muted">No finding recorded.</p>
      ) : (
        assertions.map((item) => (
          <div key={item.id} className="platform-stack">
            <p>{item.value_text ?? 'Unknown — not supplied.'}</p>
            <p className="platform-note">
              {item.status}
              {item.ends_at ? ` · Expires ${item.ends_at}` : ''}
            </p>
            <details className="platform-review-details">
              <summary>Source evidence</summary>
              <p className="platform-muted">
                Source {item.source_id} · {item.method} · captured {item.captured_at}
              </p>
              <blockquote>{item.excerpt}</blockquote>
              <p className="platform-note">{item.locator}</p>
            </details>
          </div>
        ))
      )}
    </div>
  );
}

export function KnowledgeChanges({
  view,
  refresh,
  canWrite,
  busy,
  onReview,
}: Readonly<{
  view: View;
  refresh: () => void;
  canWrite: boolean;
  busy: boolean;
  onReview: (input: LifecycleReview) => Promise<void>;
}>) {
  const changed = view.groups.filter(
    (group) => group.change !== 'unchanged' || group.expired || group.conflicted,
  );
  const labels = {
    added: 'Added finding',
    removed: 'Removed finding',
    changed: 'Changed finding',
    evidence_changed: 'Additional or revised evidence',
    unchanged: 'Unchanged finding',
  };
  return (
    <section className="platform-card platform-pad platform-stack" data-testid="knowledge-changes">
      <h2>Changes and freshness</h2>
      <p>
        {view.baseline
          ? `Compared with approved version ${view.baseline.version}. The approved snapshot is preserved.`
          : 'No approved version yet. Review these findings before approving the brand.'}
      </p>
      <p className="platform-note">Checked {view.evaluated_at}</p>
      <button type="button" onClick={refresh}>
        Refresh comparison
      </button>
      {view.source_changes.map((change) => (
        <p className="platform-note" key={change.previous_source_id}>
          Source {change.previous_source_id} has changed at {change.changed_origin_count}{' '}
          {change.changed_origin_count === 1 ? 'origin' : 'origins'}. Replacement source{' '}
          {change.latest_source_id} is the latest capture, completed {change.captured_at}.
          {change.capture_job_id ? ` Capture reference: ${change.capture_job_id}.` : ''} Review the
          source history and affected findings; the approved snapshot remains preserved.
        </p>
      ))}
      {view.expired_baseline_assertion_ids.length > 0 ? (
        <p role="status">
          An offer in the approved version has expired. Review the offer and approve a new version
          before using it in a new campaign.
        </p>
      ) : null}
      {changed.length === 0 ? (
        <p>No changed findings or freshness issues were found.</p>
      ) : (
        changed.map((group) => (
          <details
            className="platform-review-details"
            key={`${group.kind}:${group.field_key}`}
            data-testid="knowledge-change-group"
          >
            <summary>
              {group.field_key.replaceAll('_', ' ')} · {labels[group.change]}
              {group.source_missing
                ? ' · Missing from latest source — review required'
                : group.conflicted
                  ? ' · Conflicting facts — review required'
                  : ''}
              {group.expired ? ' · Expired offer' : ''}
            </summary>
            <div className="platform-stack">
              <Evidence title="Approved finding" assertions={group.baseline_assertions} />
              <Evidence title="Current evidence" assertions={group.current_assertions} />
              {canWrite && group.conflicted ? (
                <ReviewForm
                  key={`conflict:${view.draft_hash}`}
                  label="Conflict review"
                  offer={group.kind === 'offer'}
                  busy={busy}
                  onSave={(value) =>
                    onReview({
                      ...value,
                      operation: 'resolve_brand_contradiction',
                      kind: group.kind,
                      field_key: group.field_key,
                    })
                  }
                />
              ) : null}
              {canWrite && !group.conflicted && group.expired
                ? group.current_assertions
                    .filter(
                      (item) =>
                        item.status !== 'unknown' && expiryReached(item.ends_at, view.evaluated_at),
                    )
                    .map((item) => (
                      <ReviewForm
                        key={`expiry:${item.id}:${view.draft_hash}`}
                        label="Expiry review"
                        offer
                        busy={busy}
                        onSave={(value) =>
                          onReview({
                            ...value,
                            operation: 'review_expired_offer',
                            assertion_id: item.id,
                          })
                        }
                      />
                    ))
                : null}
            </div>
          </details>
        ))
      )}
    </section>
  );
}
