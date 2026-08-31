'use client';

import { MonoCaps } from '@mustbeviral/ui';
import { useEffect, useState } from 'react';

import { readCampaignProgress, type CampaignProgress } from '../campaign/campaign-progress';
import { createBrowserCoreClient } from '../../lib/core/browser-client';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';
import {
  DEFAULT_PLATFORM_KILL_SWITCHES,
  fetchPlatformKillSwitches,
  type PlatformKillSwitchSnapshot,
} from '../../lib/platform/kill-switches';

interface KillSwitchSnapshot {
  readonly providerRunsEnabled: boolean;
  readonly generationEnabled: boolean;
  readonly chargingEnabled: boolean;
  readonly signupsEnabled: boolean;
}

function toKillSwitchSnapshot(snapshot: PlatformKillSwitchSnapshot): KillSwitchSnapshot {
  return {
    providerRunsEnabled: snapshot.providerRoutesEnabled,
    generationEnabled: snapshot.generationEnabled,
    chargingEnabled: snapshot.chargingEnabled,
    signupsEnabled: snapshot.signupsEnabled,
  };
}

export function InternalOperationsPanel({ workspace }: Readonly<{ workspace: string }>) {
  const [progress] = useState<CampaignProgress | null>(() =>
    typeof window === 'undefined' ? null : readCampaignProgress(),
  );
  const [workspaceLabel, setWorkspaceLabel] = useState<string>(workspace);
  const [killSwitches, setKillSwitches] = useState<KillSwitchSnapshot>(() =>
    toKillSwitchSnapshot(DEFAULT_PLATFORM_KILL_SWITCHES),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        const client = createBrowserCoreClient();
        const result = await client.request('get_workspace', {
          id: workspace,
          requestId: crypto.randomUUID(),
        });
        if (!cancelled && 'data' in result) {
          setWorkspaceLabel(result.data.workspace.name);
        }
      } catch {
        if (!cancelled) setError('Workspace details are unavailable in this environment.');
      }
    }
    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  useEffect(() => {
    let cancelled = false;
    async function loadKillSwitches() {
      try {
        const supabase = createBrowserSupabaseClient();
        const snapshot = await fetchPlatformKillSwitches(supabase);
        if (!cancelled) setKillSwitches(toKillSwitchSnapshot(snapshot));
      } catch {
        if (!cancelled) setKillSwitches(toKillSwitchSnapshot(DEFAULT_PLATFORM_KILL_SWITCHES));
      }
    }
    void loadKillSwitches();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="internal-ops" id="main-content">
      <div className="internal-ops__grid">
        <section className="internal-ops__card" aria-labelledby="internal-heading">
          <MonoCaps>Operator / internal</MonoCaps>
          <h1 id="internal-heading">Runs, costs, and kill switches</h1>
          <p>
            Internal visibility for reconciliation and safety controls. This surface is not a public
            settings admin and does not mutate provider or billing state without authorized Core
            commands.
          </p>
        </section>

        <section className="internal-ops__card" aria-labelledby="workspace-heading">
          <MonoCaps>Workspace</MonoCaps>
          <h2 id="workspace-heading">{workspaceLabel}</h2>
          {error === null ? null : <p role="status">{error}</p>}
          <dl>
            <div>
              <dt>Sentinel / id</dt>
              <dd>{workspace}</dd>
            </div>
            <div>
              <dt>Browser session step</dt>
              <dd>{progress?.stepLabel ?? 'None saved'}</dd>
            </div>
          </dl>
        </section>

        <section className="internal-ops__card" aria-labelledby="kill-switch-heading">
          <MonoCaps>Kill switches</MonoCaps>
          <h2 id="kill-switch-heading">Product safety gates</h2>
          <dl>
            {(
              [
                ['Provider routes', killSwitches.providerRunsEnabled],
                ['Generation', killSwitches.generationEnabled],
                ['Customer charging', killSwitches.chargingEnabled],
                ['Self-service signup', killSwitches.signupsEnabled],
              ] as const
            ).map(([label, enabled]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <span
                    className={`internal-kill-switch ${enabled ? 'internal-kill-switch--on' : 'internal-kill-switch--off'}`}
                  >
                    {enabled ? 'Enabled' : 'Disabled / closed'}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="auth-policy">
            P0 keeps charging and signup closed. P1a extends these switches to Stripe settlement and
            enrollment without enabling public signup by default.
          </p>
        </section>

        <section className="internal-ops__card" aria-labelledby="reconciliation-heading">
          <MonoCaps>Reconciliation</MonoCaps>
          <h2 id="reconciliation-heading">Landed cost honesty</h2>
          <p>
            Catalog capture remains 4,550,000 micros per complete pack — the customer charge, not a
            provider invoice. Fully landed cost instrumentation sums immutable provider, storage,
            execution, and artifact evidence when observable.
          </p>
          <p className="auth-policy">
            Operator reconciliation commands and provider outbox status stay on Core; this page does
            not expose secrets, signed URLs, or customer media.
          </p>
        </section>
      </div>
    </main>
  );
}
