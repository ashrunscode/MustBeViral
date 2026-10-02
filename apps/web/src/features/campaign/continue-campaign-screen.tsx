'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';

import {
  campaignProgressSnapshot,
  clearCampaignProgress,
  subscribeCampaignProgress,
} from '../../features/campaign/campaign-progress';

export function ContinueCampaignScreen({
  defaultWorkspace,
}: Readonly<{ defaultWorkspace: string }>) {
  // The server renders no saved step; the client subscribes to the stored one after hydration.
  const progress = useSyncExternalStore(
    subscribeCampaignProgress,
    campaignProgressSnapshot,
    () => null,
  );

  const startHref = `/studio/${defaultWorkspace}/brief`;

  return (
    <main className="continue-page" id="main-content">
      <section aria-labelledby="continue-heading" className="continue-card">
        <span className="pub-wordmark" translate="no">
          {'Must\u00a0Be\u00a0Viral'}
        </span>
        <h1 id="continue-heading">Continue this campaign</h1>
        <p className="continue-lede">
          Pick up where you left off or start a fresh launch pack. Studio remembers your last
          workflow step in this browser session only — not a project dashboard.
        </p>

        {progress === null ? (
          <div className="continue-panel">
            <p>No in-progress step is saved for this browser yet.</p>
            <Link className="auth-primary auth-primary--link continue-action" href={startHref}>
              Start campaign brief
            </Link>
          </div>
        ) : (
          <div className="continue-panel">
            <p>
              <strong>{progress.campaignLabel}</strong> paused at{' '}
              <strong>{progress.stepLabel}</strong>.
            </p>
            <p className="auth-policy">
              Last touched {new Date(progress.savedAt).toLocaleString()}.
            </p>
            <div className="continue-actions">
              <Link
                className="auth-primary auth-primary--link continue-action"
                href={progress.resumeHref}
              >
                Resume {progress.stepLabel.toLowerCase()}
              </Link>
              <Link className="auth-secondary continue-action" href={startHref}>
                Start new brief
              </Link>
              <button
                className="auth-link continue-reset"
                type="button"
                onClick={() => {
                  clearCampaignProgress();
                }}
              >
                Forget saved step
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
