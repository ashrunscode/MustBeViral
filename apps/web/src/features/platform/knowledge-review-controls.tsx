'use client';

import { useState, type FormEvent } from 'react';
import type { PlatformInput, PlatformOutput } from '@mustbeviral/contracts';
import { KnowledgeExpiryInputSchema } from '@mustbeviral/contracts';

type Assertion = PlatformOutput<'get_knowledge_review'>['current_assertions'][number];
type Proposal = PlatformOutput<'get_knowledge_review'>['current_proposals'][number];
export type AssertionCorrection = Pick<
  PlatformInput<'correct_brand_assertion'>,
  'value_text' | 'excerpt' | 'ends_at'
>;
export type ProposalCorrection = Pick<
  PlatformInput<'correct_brand_proposal'>,
  'value_text' | 'excerpt'
>;

export function AssertionCorrectionForm({
  assertion,
  busy,
  pending,
  onSave,
}: Readonly<{
  assertion: Assertion;
  busy: boolean;
  pending: boolean;
  onSave: (correction: AssertionCorrection) => Promise<void>;
}>) {
  const [text, setText] = useState(assertion.value_text ?? '');
  const [excerpt, setExcerpt] = useState('');
  const [expiryMode, setExpiryMode] = useState('keep');
  const [expiry, setExpiry] = useState(assertion.ends_at ?? '');
  const invalidExpiry =
    expiryMode === 'change' && !KnowledgeExpiryInputSchema.safeParse(expiry.trim()).success;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (invalidExpiry || text.length > 4000) return;
    await onSave({
      value_text: text.trim() === '' ? null : text,
      excerpt: excerpt.trim() || 'Operator assertion correction.',
      ...(expiryMode === 'clear'
        ? { ends_at: null }
        : expiryMode === 'change'
          ? { ends_at: expiry.trim() }
          : {}),
    });
  }
  return (
    <form className="platform-stack" onSubmit={(event) => void save(event)}>
      <fieldset disabled={busy}>
        <label>
          Correct this assertion
          <textarea
            value={text}
            maxLength={4000}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <p className="platform-note">
          Leave the assertion empty to mark it unknown and clear its expiry.
        </p>
        {text.length > 4000 ? (
          <p role="alert">
            Shorten the correction to 4,000 characters before saving. The full source is retained.
          </p>
        ) : null}
        {assertion.kind === 'offer' ? (
          <>
            <label>
              Offer expiry action
              <select value={expiryMode} onChange={(event) => setExpiryMode(event.target.value)}>
                <option value="keep">Keep current expiry</option>
                <option value="change">Change expiry</option>
                <option value="clear">Clear expiry</option>
              </select>
            </label>
            {expiryMode === 'change' ? (
              <label>
                Offer expiry with timezone
                <input
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  placeholder="2098-01-01T18:00:00-06:00"
                  aria-describedby="offer-expiry-help"
                  aria-invalid={invalidExpiry}
                  required
                />
              </label>
            ) : null}
            <p className="platform-note" id="offer-expiry-help">
              Use an exact date and time with Z or a timezone offset. A date-only source expires at
              the start of that UTC date; review it here before approval.
            </p>
          </>
        ) : null}
        <label>
          Why this assertion correction
          <input
            value={excerpt}
            maxLength={2000}
            onChange={(event) => setExcerpt(event.target.value)}
          />
        </label>
        <button
          className="platform-primary"
          type="submit"
          disabled={invalidExpiry || text.length > 4000}
        >
          {pending ? 'Saving assertion…' : 'Save assertion'}
        </button>
      </fieldset>
    </form>
  );
}

export function ProposalReview({
  proposal,
  assertions,
  canWrite,
  busy,
  onSave,
}: Readonly<{
  proposal: Proposal;
  assertions: readonly Assertion[];
  canWrite: boolean;
  busy: boolean;
  onSave: (correction: ProposalCorrection) => Promise<void>;
}>) {
  const [text, setText] = useState(proposal.value_text ?? '');
  const [excerpt, setExcerpt] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (text.length > 4000) return;
    await onSave({
      value_text: text.trim() === '' ? null : text,
      excerpt: excerpt.trim() || 'Operator proposal correction.',
    });
  }
  return (
    <li data-testid={`proposal-${proposal.kind}`}>
      <p>
        {proposal.kind}, {proposal.status}
        {proposal.confidence ? `, ${proposal.confidence}` : ''},{' '}
        {proposal.value_text ?? 'Unknown: not supplied.'}
      </p>
      <details className="platform-review-details">
        <summary>Evidence for {proposal.kind}</summary>
        <blockquote>{proposal.excerpt}</blockquote>
        {proposal.evidence_field_keys.length === 0 ? (
          <p className="platform-muted">
            No source findings linked. Review the operator statement or supply source evidence.
          </p>
        ) : (
          <ul className="platform-stack">
            {proposal.evidence_field_keys.map((key) => {
              const linked = assertions.filter((item) => item.field_key === key);
              return (
                <li key={key}>
                  <strong>{key}</strong>
                  {linked.length === 0 ? (
                    <p>Linked evidence is unavailable. Review this proposal before approval.</p>
                  ) : (
                    linked.map((item) => (
                      <div key={item.id} data-testid="proposal-evidence">
                        <p>
                          {item.kind}, {item.status}, {item.value_text ?? 'Unknown: not supplied.'}
                        </p>
                        <blockquote>{item.excerpt}</blockquote>
                        <p className="platform-muted">
                          Source {item.source_id}, {item.method}, captured {item.captured_at}
                        </p>
                        {item.ends_at ? <p>Expires {item.ends_at}</p> : null}
                      </div>
                    ))
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </details>
      {canWrite ? (
        <details className="platform-review-details">
          <summary>Correct {proposal.kind} proposal</summary>
          <form className="platform-stack" onSubmit={(event) => void save(event)}>
            <fieldset disabled={busy}>
              <label>
                Revised {proposal.kind} proposal
                <textarea
                  value={text}
                  maxLength={4000}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
              <p className="platform-note">
                Leave empty to mark this proposal unknown. Saving preserves its evidence and creates
                an unapproved revision.
              </p>
              {text.length > 4000 ? (
                <p role="alert">
                  Shorten the correction to 4,000 characters before saving. The previous proposal is
                  retained.
                </p>
              ) : null}
              <label>
                Why this proposal correction
                <input
                  value={excerpt}
                  maxLength={2000}
                  onChange={(event) => setExcerpt(event.target.value)}
                />
              </label>
              <button type="submit" disabled={text.length > 4000}>
                Save {proposal.kind} proposal
              </button>
            </fieldset>
          </form>
        </details>
      ) : null}
    </li>
  );
}
