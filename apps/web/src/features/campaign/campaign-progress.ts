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

export function isCampaignWorkflowStep(value: unknown): value is CampaignWorkflowStep {
  return typeof value === 'string' && Object.hasOwn(stepLabels, value);
}

export function campaignResumeHref(workspace: string, step: CampaignWorkflowStep): string {
  return `/studio/${encodeURIComponent(workspace)}/${step}`;
}

export function readCampaignProgress(): CampaignProgress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      !('workspace' in parsed) ||
      typeof parsed.workspace !== 'string' ||
      !/^[a-z0-9_-]{1,100}$/iu.test(parsed.workspace) ||
      !('step' in parsed) ||
      !isCampaignWorkflowStep(parsed.step) ||
      !('resumeHref' in parsed) ||
      parsed.resumeHref !== campaignResumeHref(parsed.workspace, parsed.step) ||
      !('savedAt' in parsed) ||
      typeof parsed.savedAt !== 'string' ||
      !Number.isFinite(Date.parse(parsed.savedAt)) ||
      !('campaignLabel' in parsed) ||
      typeof parsed.campaignLabel !== 'string'
    ) {
      return null;
    }
    return {
      workspace: parsed.workspace,
      step: parsed.step,
      stepLabel: stepLabels[parsed.step],
      resumeHref: parsed.resumeHref,
      savedAt: parsed.savedAt,
      campaignLabel: parsed.campaignLabel,
    };
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
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Optional browser resume must not break the active workflow when storage is denied/full.
    }
  }
  return progress;
}

export function clearCampaignProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing unavailable browser storage does not affect authoritative campaign state.
  }
}
