import {
  campaignHref,
  type CampaignContext,
  type CampaignStep,
} from '../platform/platform-navigation';

export type CampaignWorkflowStep = 'brief' | 'canvas' | 'quote' | 'review' | 'receipt';

export interface CampaignProgress {
  readonly workspace: string;
  readonly step: CampaignWorkflowStep;
  readonly stepLabel: string;
  readonly resumeHref: string;
  readonly savedAt: string;
  readonly campaignLabel: string;
  /** The studio, brand, plan and run the step belonged to, so resuming opens the same records. */
  readonly context: CampaignContext;
}

const STORAGE_KEY = 'mbv.campaign.progress';

const stepLabels: Readonly<Record<CampaignWorkflowStep, string>> = {
  brief: 'Campaign brief',
  canvas: 'Campaign plan',
  quote: 'Quote and confirmation',
  review: 'Review and approval',
  receipt: 'Export and receipt',
};

export function isCampaignWorkflowStep(value: unknown): value is CampaignWorkflowStep {
  return typeof value === 'string' && Object.hasOwn(stepLabels, value);
}

const stepKeys: Readonly<Record<CampaignWorkflowStep, CampaignStep>> = {
  brief: 'brief',
  canvas: 'plan',
  quote: 'budget',
  review: 'content',
  receipt: 'results',
};

const CONTEXT_KEYS = ['studio', 'brand', 'canvas', 'revision', 'run'] as const;

/** Keep only well-formed identifiers; anything else is dropped rather than trusted. */
export function sanitizeCampaignContext(value: unknown): CampaignContext {
  if (typeof value !== 'object' || value === null) return {};
  const record = value as Readonly<Record<string, unknown>>;
  const context: { -readonly [K in keyof CampaignContext]?: string } = {};
  for (const key of CONTEXT_KEYS) {
    const entry = record[key];
    if (typeof entry === 'string' && /^[a-z0-9_-]{1,100}$/iu.test(entry)) context[key] = entry;
  }
  return context;
}

export function campaignResumeHref(
  workspace: string,
  step: CampaignWorkflowStep,
  context: CampaignContext = {},
): string {
  const hasContext = CONTEXT_KEYS.some((key) => context[key] !== undefined);
  if (!hasContext) return `/studio/${encodeURIComponent(workspace)}/${step}`;
  return campaignHref(workspace, stepKeys[step], context);
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
      parsed.resumeHref !==
        campaignResumeHref(
          parsed.workspace,
          parsed.step,
          sanitizeCampaignContext((parsed as { context?: unknown }).context),
        ) ||
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
      context: sanitizeCampaignContext((parsed as { context?: unknown }).context),
    };
  } catch {
    return null;
  }
}

/*
 * A tiny external store so screens can read the saved step with useSyncExternalStore: the server
 * snapshot is null, the client snapshot is cached by the raw stored string, and every write or
 * clear notifies subscribers.
 */
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedProgress: CampaignProgress | null = null;

export function subscribeCampaignProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyCampaignProgress(): void {
  for (const listener of listeners) listener();
}

export function campaignProgressSnapshot(): CampaignProgress | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedProgress = readCampaignProgress();
  }
  return cachedProgress;
}

export function writeCampaignProgress(input: {
  readonly workspace: string;
  readonly step: CampaignWorkflowStep;
  readonly campaignLabel?: string;
  readonly context?: CampaignContext;
}): CampaignProgress {
  const context = sanitizeCampaignContext(input.context ?? {});
  const progress: CampaignProgress = Object.freeze({
    workspace: input.workspace,
    step: input.step,
    stepLabel: stepLabels[input.step],
    resumeHref: campaignResumeHref(input.workspace, input.step, context),
    savedAt: new Date().toISOString(),
    campaignLabel: input.campaignLabel ?? 'Current campaign',
    context,
  });
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Optional browser resume must not break the active workflow when storage is denied/full.
    }
  }
  notifyCampaignProgress();
  return progress;
}

export function clearCampaignProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing unavailable browser storage does not affect authoritative campaign state.
  }
  notifyCampaignProgress();
}
