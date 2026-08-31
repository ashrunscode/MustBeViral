export type CampaignWorkflowStep = 'brief' | 'canvas' | 'quote' | 'review' | 'receipt';

export interface CampaignProgress {
  readonly workspace: string;
  readonly step: CampaignWorkflowStep;
  readonly stepLabel: string;
  readonly resumeHref: string;
  readonly savedAt: string;
  readonly campaignLabel: string;
}

const STORAGE_KEY = 'mbv.campaign.progress';

const stepLabels: Readonly<Record<CampaignWorkflowStep, string>> = {
  brief: 'Campaign brief',
  canvas: 'Launch-pack canvas',
  quote: 'Quote and confirmation',
  review: 'Review and approval',
  receipt: 'Export and receipt',
};

export function campaignResumeHref(workspace: string, step: CampaignWorkflowStep): string {
  return `/studio/${workspace}/${step}`;
}

export function readCampaignProgress(): CampaignProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as CampaignProgress;
    if (
      typeof parsed.workspace !== 'string' ||
      typeof parsed.step !== 'string' ||
      typeof parsed.resumeHref !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCampaignProgress(input: {
  readonly workspace: string;
  readonly step: CampaignWorkflowStep;
  readonly campaignLabel?: string;
}): CampaignProgress {
  const progress: CampaignProgress = Object.freeze({
    workspace: input.workspace,
    step: input.step,
    stepLabel: stepLabels[input.step],
    resumeHref: campaignResumeHref(input.workspace, input.step),
    savedAt: new Date().toISOString(),
    campaignLabel: input.campaignLabel ?? 'Current launch pack',
  });
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }
  return progress;
}

export function clearCampaignProgress(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
