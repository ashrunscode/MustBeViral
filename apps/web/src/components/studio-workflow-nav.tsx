'use client';

import { MonoCaps } from '@mustbeviral/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import {
  writeCampaignProgress,
  type CampaignWorkflowStep,
} from '../features/campaign/campaign-progress';

const workflowSteps = [
  { segment: 'brief', label: 'Brief' },
  { segment: 'canvas', label: 'Canvas' },
  { segment: 'quote', label: 'Quote' },
  { segment: 'review', label: 'Review' },
  { segment: 'receipt', label: 'Receipt' },
  { segment: 'billing', label: 'Billing' },
  { segment: 'access', label: 'Access' },
] as const;

export function workflowStepIsActive(pathSegment: string, stepSegment: string): boolean {
  if (stepSegment === 'review') {
    return pathSegment === 'review' || pathSegment === 'compare';
  }
  return pathSegment === stepSegment;
}

export function StudioWorkflowNav({ workspace }: Readonly<{ workspace: string }>) {
  const pathname = usePathname();
  const pathSegment = pathname.split('/').filter(Boolean).at(-1) ?? 'brief';

  useEffect(() => {
    const step = workflowSteps.find((entry) => workflowStepIsActive(pathSegment, entry.segment));
    if (step === undefined) return;
    writeCampaignProgress({
      workspace,
      step: step.segment as CampaignWorkflowStep,
      campaignLabel: 'Current launch pack',
    });
  }, [pathSegment, workspace]);

  return (
    <nav aria-label="Campaign workflow" className="studio-workflow-nav">
      <ol className="studio-workflow-nav__list">
        {workflowSteps.map((step) => {
          const active = workflowStepIsActive(pathSegment, step.segment);
          return (
            <li key={step.segment}>
              <Link
                aria-current={active ? 'page' : undefined}
                className={`studio-workflow-nav__link${active ? ' studio-workflow-nav__link--active' : ''}`}
                href={`/studio/${workspace}/${step.segment}`}
              >
                <MonoCaps>{step.label}</MonoCaps>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
