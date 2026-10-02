'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { isCampaignWorkflowStep, writeCampaignProgress } from '../campaign/campaign-progress';
import {
  PlatformFrame,
  PlatformLoading,
  PlatformRecovery,
  type PlatformPresentation,
} from './platform-frame';
import {
  CAMPAIGN_STEPS,
  campaignHref,
  campaignStepAvailable,
  campaignStepForSegment,
  isResourceId,
  studioHref,
  type CampaignContext,
  type CampaignStep,
} from './platform-navigation';
import { readCampaignContext } from './campaign-context';
import { usePlatformQuery } from './use-platform-query';

/** Workflow segments that fill the main region edge to edge. */
const APP_HEIGHT_SEGMENTS = new Set(['brief', 'canvas', 'quote', 'review', 'compare', 'receipt']);

/**
 * Frames every route under /studio/[workspace] that is not a brand, project or owner billing
 * page: the campaign steps, their calendar, collaborators and approvals, and the workspace tools.
 */
export function WorkspaceFrame({
  children,
  workspace,
  presentation,
}: Readonly<{
  children: ReactNode;
  workspace: string;
  presentation: PlatformPresentation;
}>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (
    pathname.startsWith(`/studio/${workspace}/brands/`) ||
    pathname.startsWith(`/studio/${workspace}/projects/`) ||
    (presentation === 'authenticated' && pathname === `/studio/${workspace}/billing`)
  )
    return children;
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'brief';
  const context = readCampaignContext(searchParams);
  const step = campaignStepForSegment(segment);
  return (
    <CampaignShell
      workspace={workspace}
      presentation={presentation}
      context={context}
      step={step}
      segment={segment}
    >
      {children}
    </CampaignShell>
  );
}

function CampaignShell({
  children,
  workspace,
  presentation,
  context,
  step,
  segment,
}: Readonly<{
  children: ReactNode;
  workspace: string;
  presentation: PlatformPresentation;
  context: CampaignContext;
  step: CampaignStep | null;
  segment: string;
}>) {
  const authenticated = presentation === 'authenticated';
  const studioId = isResourceId(context.studio) ? context.studio : undefined;
  const brandId = isResourceId(context.brand) ? context.brand : undefined;
  const studio = usePlatformQuery(
    'get_studio_access',
    { studio_id: studioId ?? '' },
    authenticated && studioId !== undefined,
  );
  const brand = usePlatformQuery(
    'get_brand_access',
    { studio_id: studioId ?? '', workspace_id: workspace, brand_id: brandId ?? '' },
    authenticated && studioId !== undefined && brandId !== undefined && isResourceId(workspace),
  );
  const brandName = brand.data?.brand.name;
  // One scope: the studio must open, the brand must belong to the route's workspace, and nothing
  // renders or saves until that is confirmed. A link that mixes two workspaces is refused.
  const scopeError = studio.error ?? brand.error;
  const scopeMismatch = brand.data !== undefined && brand.data.brand.workspace_id !== workspace;
  const scopePending =
    authenticated &&
    ((studioId !== undefined && studio.loading) ||
      (studioId !== undefined && brandId !== undefined && brand.loading));
  const scopeConfirmed = scopeError === undefined && !scopeMismatch && !scopePending;
  useEffect(() => {
    if (!scopeConfirmed) return;
    const workflowStep = segment === 'compare' ? 'review' : segment;
    if (!isCampaignWorkflowStep(workflowStep)) return;
    writeCampaignProgress({
      workspace,
      step: workflowStep,
      context,
      ...(brandName ? { campaignLabel: `${brandName} campaign` } : {}),
    });
    // The context's identity is its serialized values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, workspace, brandName, scopeConfirmed, JSON.stringify(context)]);
  const studioContext = studio.data
    ? { id: studio.data.studio.id, name: studio.data.studio.name, role: studio.data.role }
    : undefined;
  const brandContext =
    brand.data && studioId
      ? { id: brand.data.brand.id, name: brand.data.brand.name, workspaceId: workspace }
      : undefined;
  const label = step
    ? (CAMPAIGN_STEPS.find((entry) => entry.key === step)?.label ?? 'Campaign')
    : segment === 'access'
      ? 'API access'
      : segment === 'skills'
        ? 'Skills'
        : segment === 'internal'
          ? 'Internal operations'
          : segment === 'billing'
            ? 'Billing'
            : 'Campaign';
  return (
    <PlatformFrame
      presentation={presentation}
      studio={studioContext}
      brand={brandContext}
      section={studioContext ? 'brands' : undefined}
      campaignLabel={step ? `Campaign: ${label}` : label}
      flush={APP_HEIGHT_SEGMENTS.has(segment)}
    >
      {step ? (
        <CampaignNav
          workspace={workspace}
          context={context}
          current={step}
          preview={!authenticated}
        />
      ) : null}
      <div className="platform-fill">
        {scopeError !== undefined ? (
          <PlatformRecovery
            error={scopeError}
            retry={() => {
              studio.refresh();
              brand.refresh();
            }}
          />
        ) : scopeMismatch ? (
          <section className="platform-card platform-pad platform-stack" role="alert">
            <h2>This link mixes two workspaces.</h2>
            <p>
              The brand in this link belongs to another workspace, so nothing from it is shown here.
              Nothing changed. Open the campaign from its brand.
            </p>
            <div className="platform-row">
              <Link className="platform-button platform-primary" href={studioHref(studioId)}>
                Open the studio
              </Link>
            </div>
          </section>
        ) : scopePending ? (
          <PlatformLoading label="Confirming the studio and brand for this campaign…" />
        ) : (
          children
        )}
      </div>
    </PlatformFrame>
  );
}

function CampaignNav({
  workspace,
  context,
  current,
  preview,
}: Readonly<{
  workspace: string;
  context: CampaignContext;
  current: CampaignStep;
  preview: boolean;
}>) {
  const waitingOnPlan: string[] = [];
  const waitingOnRun: string[] = [];
  return (
    <nav aria-label="Campaign workflow" className="platform-tabs platform-campaign-nav">
      {CAMPAIGN_STEPS.map((entry) => {
        const available =
          preview || entry.key === current || campaignStepAvailable(entry.key, context);
        if (!available) (entry.needs === 'run' ? waitingOnRun : waitingOnPlan).push(entry.label);
        return available ? (
          <Link
            key={entry.key}
            href={campaignHref(workspace, entry.key, context)}
            aria-current={current === entry.key ? 'page' : undefined}
          >
            {entry.label}
          </Link>
        ) : (
          <span key={entry.key} aria-disabled="true">
            {entry.label}
          </span>
        );
      })}
      {waitingOnPlan.length > 0 || waitingOnRun.length > 0 ? (
        <p className="platform-tabs__reason">
          {waitingOnPlan.length > 0
            ? `${waitingOnPlan.join(' and ')} open after the brief is planned.`
            : ''}
          {waitingOnPlan.length > 0 && waitingOnRun.length > 0 ? ' ' : ''}
          {waitingOnRun.length > 0
            ? `${waitingOnRun.join(', ')} open after a run is confirmed.`
            : ''}
        </p>
      ) : null}
    </nav>
  );
}
