import {
  evaluateLaunchPackCopy,
  type MustBeViralRestClient,
  type P0OperationData,
} from '@mustbeviral/contracts';
import {
  runRecoveryView,
  runSettlementView,
  type RunRecoveryView,
  type RunSettlementView,
} from '../run/run-recovery';
import {
  SESSION_EXPIRED_RESULT,
  isSessionExpiredFailure,
  type SessionExpiredResult,
} from '../../lib/core/session-expiry';

export type ReviewDecision = 'pending' | 'approved' | 'rejected';

export interface ReviewCopyPreview {
  readonly primaryText: string;
  readonly headline: string;
  readonly description: string;
}

export interface ReviewVariant {
  readonly id: string;
  readonly groupId: string;
  readonly label: string;
  readonly format: string;
  readonly model: string;
  readonly decision: ReviewDecision;
  readonly accessibilityDescription: string | null;
  readonly hasPrior: boolean;
  readonly rejectionReason?: string;
  readonly previewUrl?: string | null;
  readonly copy?: ReviewCopyPreview | null;
  readonly nodeKey?: string;
}

export type ReviewPlacement = '4:5' | '1:1' | '9:16' | 'reels';

export interface ReviewConcept {
  readonly id: string;
  readonly index: number;
  readonly title: string;
  readonly angle: string;
  readonly copy: ReviewCopyPreview | null;
  readonly copyVariant: ReviewVariant | null;
  readonly master: ReviewVariant | null;
  readonly placements: Readonly<{
    '4:5': ReviewVariant | null;
    '1:1': ReviewVariant | null;
    '9:16': ReviewVariant | null;
  }>;
  readonly motion: ReviewVariant | null;
  readonly decision: ReviewDecision;
  readonly members: readonly ReviewVariant[];
}

export interface ArtifactGroupReview {
  readonly id: string;
  readonly name: string;
  readonly reviewer: string;
  readonly decision: ReviewDecision;
  readonly variants: readonly ReviewVariant[];
  readonly revision: string;
}

export interface ReviewQaFinding {
  readonly variantId: string;
  readonly label: string;
  readonly code: string;
  readonly message: string;
}

export interface ReviewSummary {
  readonly authorizedMicros: bigint;
  readonly quotedMicros: bigint;
  readonly capturedMicros: bigint;
  readonly releasedMicros: bigint;
  readonly refundedMicros: bigint;
  readonly pendingMicros: bigint;
  readonly netMicros: bigint;
  readonly settlementStatus: P0OperationData<'get_run'>['spend']['settlementStatus'];
  readonly budgetUsedMicros: bigint;
  readonly budgetCapMicros: bigint;
  readonly exportReady: boolean;
  readonly qaNoteCount: number;
  readonly qaFindings: readonly ReviewQaFinding[];
  readonly route: string;
  readonly campaignName: string | null;
  readonly recovery: RunRecoveryView | null;
}

export type ReviewPortResult =
  | { readonly type: 'ok'; readonly groups: readonly ArtifactGroupReview[] }
  | { readonly type: 'reason_required'; readonly variant_id: string }
  | { readonly type: 'conflict'; readonly actual_revision_id: string }
  | { readonly type: 'not_found'; readonly artifact_id: string }
  | { readonly type: 'description_required'; readonly artifact_id: string }
  | { readonly type: 'forbidden' }
  | SessionExpiredResult
  | {
      readonly type: 'error';
      readonly message: string;
      readonly retryable: boolean;
      readonly request_id?: string;
    };

export type ReviewReadResult =
  | {
      readonly type: 'ok';
      readonly groups: readonly ArtifactGroupReview[];
      readonly summary: ReviewSummary;
    }
  | Exclude<ReviewPortResult, { type: 'ok' | 'reason_required' | 'description_required' }>;

export interface ReviewReadPort {
  read(): Promise<ReviewReadResult>;
  describeVariant(input: Readonly<{ variantId: string; description: string }>): void;
  decideVariant(
    input: Readonly<{
      variantId: string;
      decision: Exclude<ReviewDecision, 'pending'>;
      reason?: string;
      expectedRevisionId: string;
    }>,
  ): Promise<ReviewPortResult>;
  approveGroup(
    input: Readonly<{ groupId: string; reviewer: string; expectedRevisionId: string }>,
  ): Promise<ReviewPortResult>;
  approveMembers(
    input: Readonly<{ variantIds: readonly string[]; expectedRevisionId: string }>,
  ): Promise<ReviewPortResult>;
}

export interface ReviewPort {
  read(): readonly ArtifactGroupReview[];
  describeVariant(input: Readonly<{ variantId: string; description: string }>): void;
  decideVariant(
    input: Readonly<{
      variantId: string;
      decision: Exclude<ReviewDecision, 'pending'>;
      reason?: string;
      expectedRevisionId: string;
    }>,
  ): ReviewPortResult;
  approveGroup(
    input: Readonly<{ groupId: string; reviewer: string; expectedRevisionId: string }>,
  ): ReviewPortResult;
}

const goldenGroups: readonly ArtifactGroupReview[] = [
  {
    id: 'visuals',
    name: 'Visual system',
    reviewer: 'Maya Chen',
    decision: 'pending',
    revision: '7f3a',
    variants: [
      {
        id: 'hero-a',
        groupId: 'visuals',
        label: 'Hero A',
        format: '1080 x 1350',
        model: 'flux-2-klein',
        decision: 'approved',
        accessibilityDescription: 'Hero product still life for the launch campaign.',
        hasPrior: true,
      },
      {
        id: 'hero-b',
        groupId: 'visuals',
        label: 'Hero B',
        format: '1080 x 1350',
        model: 'flux-2-klein',
        decision: 'pending',
        accessibilityDescription: 'Alternate hero product still life.',
        hasPrior: true,
      },
      {
        id: 'story-a',
        groupId: 'visuals',
        label: 'Story A',
        format: '1080 x 1920',
        model: 'flux-2-klein',
        decision: 'pending',
        accessibilityDescription: 'Vertical story composition for the launch campaign.',
        hasPrior: true,
      },
    ],
  },
  {
    id: 'copy',
    name: 'Copy system',
    reviewer: 'Maya Chen',
    decision: 'pending',
    revision: '7f3a',
    variants: [
      {
        id: 'copy-a',
        groupId: 'copy',
        label: 'Launch copy A',
        format: '3 placements',
        model: 'kimi-2.6',
        decision: 'pending',
        accessibilityDescription: 'Launch copy presented across three placements.',
        hasPrior: true,
      },
    ],
  },
];

export class InMemoryReviewPort implements ReviewPort {
  #groups: ArtifactGroupReview[] = goldenGroups.map((group) => ({
    ...group,
    variants: group.variants.map((variant) => ({ ...variant })),
  }));
  readonly #scenario: 'ok' | 'conflict';

  constructor(scenario: 'ok' | 'conflict' = 'ok') {
    this.#scenario = scenario;
  }

  read(): readonly ArtifactGroupReview[] {
    return this.#groups;
  }

  describeVariant(input: Readonly<{ variantId: string; description: string }>): void {
    this.#groups = applyAccessibilityDescription(this.#groups, input.variantId, input.description);
  }

  decideVariant(
    input: Readonly<{
      variantId: string;
      decision: Exclude<ReviewDecision, 'pending'>;
      reason?: string;
      expectedRevisionId: string;
    }>,
  ): ReviewPortResult {
    if (this.#scenario === 'conflict' || input.expectedRevisionId !== '7f3a')
      return { type: 'conflict', actual_revision_id: '81c2' };
    const found = this.#groups.some((group) =>
      group.variants.some((variant) => variant.id === input.variantId),
    );
    if (!found) return { type: 'not_found', artifact_id: input.variantId };
    if (input.decision === 'rejected' && !input.reason?.trim())
      return { type: 'reason_required', variant_id: input.variantId };
    this.#groups = this.#groups.map((group) => ({
      ...group,
      variants: group.variants.map((variant) =>
        variant.id === input.variantId
          ? {
              ...variant,
              decision: input.decision,
              ...(input.decision === 'rejected' && input.reason !== undefined
                ? { rejectionReason: input.reason.trim() }
                : {}),
            }
          : variant,
      ),
    }));
    return { type: 'ok', groups: this.#groups };
  }

  approveGroup(
    input: Readonly<{ groupId: string; reviewer: string; expectedRevisionId: string }>,
  ): ReviewPortResult {
    if (this.#scenario === 'conflict' || input.expectedRevisionId !== '7f3a')
      return { type: 'conflict', actual_revision_id: '81c2' };
    if (!this.#groups.some((group) => group.id === input.groupId))
      return { type: 'not_found', artifact_id: input.groupId };
    this.#groups = this.#groups.map((group) =>
      group.id === input.groupId
        ? {
            ...group,
            reviewer: input.reviewer,
            decision: 'approved' as const,
            variants: group.variants.map((variant) => ({
              ...variant,
              decision: variant.decision === 'rejected' ? variant.decision : ('approved' as const),
            })),
          }
        : group,
    );
    return { type: 'ok', groups: this.#groups };
  }
}

function applyAccessibilityDescription(
  groups: readonly ArtifactGroupReview[],
  variantId: string,
  description: string,
): ArtifactGroupReview[] {
  return groups.map((group) => ({
    ...group,
    variants: group.variants.map((variant) =>
      variant.id === variantId
        ? { ...variant, accessibilityDescription: description.trim() || null }
        : variant,
    ),
  }));
}

export function reviewContentUrl(accessUrl: string): string {
  try {
    const url = new URL(accessUrl);
    if (typeof window === 'undefined') return accessUrl;
    return `${window.location.origin}/api/core${url.pathname}${url.search}`;
  } catch {
    return accessUrl;
  }
}

async function loadReviewExtras(
  client: MustBeViralRestClient,
  artifacts: P0OperationData<'get_receipt'>['receipt']['artifacts'],
): Promise<
  Record<string, Readonly<{ previewUrl?: string | null; copy?: ReviewCopyPreview | null }>>
> {
  const extras: Record<string, { previewUrl?: string | null; copy?: ReviewCopyPreview | null }> =
    {};
  for (const artifact of artifacts) {
    if (
      artifact.artifact_kind !== 'provider_output' &&
      artifact.artifact_kind !== 'approved_output'
    ) {
      continue;
    }
    let detail: Awaited<ReturnType<MustBeViralRestClient['request']>>;
    try {
      detail = await client.request('get_artifact', { id: artifact.id });
    } catch (error) {
      if (isSessionExpiredFailure(error)) throw error;
      continue;
    }
    if ('error' in detail) {
      if (isSessionExpiredFailure(detail.error)) throw detail.error;
      continue;
    }
    const payload = detail.data as {
      access?: { url: string } | null;
      copy?: { primary_text: string; headline: string; description: string } | null;
    };
    if (payload.copy) {
      extras[artifact.id] = {
        copy: {
          primaryText: payload.copy.primary_text,
          headline: payload.copy.headline,
          description: payload.copy.description,
        },
      };
      continue;
    }
    if (payload.access === null || payload.access === undefined) continue;
    const previewUrl = reviewContentUrl(payload.access.url);
    if (artifact.mime_type.startsWith('image/') || artifact.mime_type.startsWith('video/')) {
      extras[artifact.id] = { previewUrl };
    }
  }
  return extras;
}

function groupKind(mimeType: string) {
  if (mimeType.startsWith('image/')) return { id: 'visuals', name: 'Visual system' };
  if (mimeType.startsWith('video/')) return { id: 'motion', name: 'Motion' };
  return { id: 'copy', name: 'Copy system' };
}

function reviewKind(nodeKey: string | undefined, mimeType: string) {
  if (nodeKey?.startsWith('copy-')) return { id: 'copy', name: 'Copy system' };
  if (nodeKey?.startsWith('master-')) return { id: 'masters', name: 'Masters' };
  if (nodeKey?.startsWith('adaptation-')) return { id: 'adaptations', name: 'Adaptations' };
  if (nodeKey?.startsWith('motion-')) return { id: 'motion', name: 'Motion' };
  return groupKind(mimeType);
}

function reviewLabel(kindId: string, indexInGroup: number): string {
  if (kindId === 'copy') return `Copy set ${String(indexInGroup + 1)}`;
  if (kindId === 'motion') return `Motion ${String(indexInGroup + 1)}`;
  if (kindId === 'masters') return `Master ${String(indexInGroup + 1)}`;
  if (kindId === 'adaptations') return `Adaptation ${String(indexInGroup + 1)}`;
  return `Visual ${String(indexInGroup + 1)}`;
}

const NAMED_NODE_LABELS: Readonly<Record<string, string>> = {
  'copy-1': 'Copy · Problem-recognition',
  'copy-2': 'Copy · Proof-first',
  'copy-3': 'Copy · Offer-clarity',
  'master-1': 'Master · Packshot',
  'master-2': 'Master · Material',
  'master-3': 'Master · Proof-forward',
  'motion-1': 'Motion · 9:16',
};

const ADAPTATION_RATIOS = ['4:5', '1:1', '9:16'] as const;

function reviewLabelFromNodeKey(
  nodeKey: string | undefined,
  kindId: string,
  indexInGroup: number,
): string {
  if (nodeKey !== undefined && NAMED_NODE_LABELS[nodeKey] !== undefined) {
    return NAMED_NODE_LABELS[nodeKey];
  }
  const adaptation = /^adaptation-(\d+)-(\d+)$/u.exec(nodeKey ?? '');
  if (adaptation !== null) {
    const ratio = ADAPTATION_RATIOS[Number(adaptation[2]) - 1] ?? '4:5';
    return `Adaptation · Master ${adaptation[1]} · ${ratio}`;
  }
  return reviewLabel(kindId, indexInGroup);
}

function reviewFormat(nodeKey: string | undefined, kindId: string, mimeType: string): string {
  const adaptation = /^adaptation-\d+-(\d+)$/u.exec(nodeKey ?? '');
  if (adaptation !== null) {
    return `${ADAPTATION_RATIOS[Number(adaptation[1]) - 1] ?? '4:5'} placement`;
  }
  if (nodeKey?.startsWith('master-')) return 'Master still';
  if (nodeKey?.startsWith('motion-')) return '9:16 · 8s';
  if (kindId === 'copy') return 'Copy set';
  if (mimeType.startsWith('image/')) return 'Still';
  if (mimeType.startsWith('video/')) return 'Motion';
  return mimeType;
}

const CONCEPT_ANGLES = ['Problem-recognition', 'Proof-first', 'Offer-clarity'] as const;
const CONCEPT_TITLES = ['Packshot', 'Material', 'Proof-forward'] as const;

export function composeReviewConcepts(
  groups: readonly ArtifactGroupReview[],
): readonly ReviewConcept[] {
  const variants = groups.flatMap((group) => group.variants);
  const byKey = new Map(
    variants.flatMap((variant) =>
      variant.nodeKey === undefined ? [] : ([[variant.nodeKey, variant]] as const),
    ),
  );
  const concepts: ReviewConcept[] = [];
  for (let index = 1; index <= 3; index += 1) {
    const copyVariant = byKey.get(`copy-${String(index)}`) ?? null;
    const master = byKey.get(`master-${String(index)}`) ?? null;
    const placements = {
      '4:5': byKey.get(`adaptation-${String(index)}-1`) ?? null,
      '1:1': byKey.get(`adaptation-${String(index)}-2`) ?? null,
      '9:16': byKey.get(`adaptation-${String(index)}-3`) ?? null,
    };
    const motion = index === 1 ? (byKey.get('motion-1') ?? null) : null;
    const members = [
      copyVariant,
      master,
      placements['4:5'],
      placements['1:1'],
      placements['9:16'],
      motion,
    ].filter((variant): variant is ReviewVariant => variant !== null);
    if (members.length === 0) continue;
    concepts.push({
      id: `concept-${String(index)}`,
      index,
      title: CONCEPT_TITLES[index - 1] ?? `Concept ${String(index)}`,
      angle: CONCEPT_ANGLES[index - 1] ?? `Angle ${String(index)}`,
      copy: copyVariant?.copy ?? null,
      copyVariant,
      master,
      placements,
      motion,
      decision: members.every((variant) => variant.decision === 'approved')
        ? 'approved'
        : members.some((variant) => variant.decision === 'rejected')
          ? 'rejected'
          : 'pending',
      members,
    });
  }
  return concepts;
}

function reviewFromReceipt(
  receipt: P0OperationData<'get_receipt'>['receipt'],
  reviewer: string,
  extras: Readonly<
    Record<string, Readonly<{ previewUrl?: string | null; copy?: ReviewCopyPreview | null }>>
  > = {},
  nodeKeys: Readonly<Record<string, string>> = {},
): Readonly<{ groups: readonly ArtifactGroupReview[]; summary: ReviewSummary }> {
  const routeIds = [...new Set(receipt.provider_jobs.map(({ route_id }) => route_id))];
  const routeLabel = routeIds.join(' + ') || 'Receipt lineage';
  const reviewable = receipt.artifacts.filter(
    (artifact) =>
      artifact.artifact_kind === 'provider_output' || artifact.artifact_kind === 'approved_output',
  );
  const groups = new Map<string, ArtifactGroupReview>();
  const groupCounts = new Map<string, number>();
  const qaFindings: ReviewQaFinding[] = [];
  for (const artifact of reviewable) {
    const nodeKey = artifact.run_node_id === null ? undefined : nodeKeys[artifact.run_node_id];
    const kind = reviewKind(nodeKey, artifact.mime_type);
    const indexInGroup = groupCounts.get(kind.id) ?? 0;
    groupCounts.set(kind.id, indexInGroup + 1);
    const extra = extras[artifact.id];
    const current = groups.get(kind.id);
    const variant: ReviewVariant = {
      id: artifact.id,
      groupId: kind.id,
      label: reviewLabelFromNodeKey(nodeKey, kind.id, indexInGroup),
      format: reviewFormat(nodeKey, kind.id, artifact.mime_type),
      // The safe receipt deliberately does not claim an artifact-to-attempt relation that the
      // persisted lineage does not prove. Exact provider/model/route rows remain in receipt lineage.
      model: routeIds.length > 0 ? 'See receipt lineage' : 'Pinned catalog route',
      decision: artifact.artifact_kind === 'approved_output' ? 'approved' : 'pending',
      accessibilityDescription: artifact.accessibility_description,
      hasPrior: receipt.lineage.some(({ child_artifact_id }) => child_artifact_id === artifact.id),
      previewUrl: extra?.previewUrl ?? null,
      copy: extra?.copy ?? null,
      ...(nodeKey === undefined ? {} : { nodeKey }),
    };
    if (extra?.copy) {
      for (const finding of evaluateLaunchPackCopy({
        primary_text: extra.copy.primaryText,
        headline: extra.copy.headline,
        description: extra.copy.description,
      })) {
        qaFindings.push({
          variantId: artifact.id,
          label: variant.label,
          code: finding.code,
          message: finding.message,
        });
      }
    }
    const variants = [...(current?.variants ?? []), variant];
    groups.set(kind.id, {
      id: kind.id,
      name: kind.name,
      reviewer: artifact.approved_at === null ? reviewer : 'Approved',
      decision: variants.every((candidate) => candidate.decision === 'approved')
        ? 'approved'
        : 'pending',
      revision: receipt.run.canvas_revision_id,
      variants,
    });
  }
  const quotedMicros = BigInt(receipt.reservation?.amount_micros ?? 0);
  const capturedMicros = BigInt(receipt.reservation?.captured_micros ?? 0);
  const releasedMicros = BigInt(receipt.reservation?.released_micros ?? 0);
  const refundedMicros = BigInt(receipt.reservation?.refunded_micros ?? 0);
  const pendingMicros = quotedMicros - capturedMicros - releasedMicros;
  return {
    groups: [...groups.values()],
    summary: {
      authorizedMicros: quotedMicros,
      quotedMicros,
      capturedMicros,
      releasedMicros,
      refundedMicros,
      pendingMicros: pendingMicros < 0n ? 0n : pendingMicros,
      netMicros: capturedMicros >= refundedMicros ? capturedMicros - refundedMicros : 0n,
      settlementStatus: receipt.reservation?.status ?? 'active',
      budgetUsedMicros: capturedMicros,
      budgetCapMicros: quotedMicros,
      exportReady: receipt.artifacts.some((artifact) => artifact.artifact_kind === 'export'),
      qaNoteCount: qaFindings.length,
      qaFindings,
      route: routeLabel,
      campaignName: null,
      recovery: null,
    },
  };
}

export class WorkerReviewPort implements ReviewReadPort {
  #groups: readonly ArtifactGroupReview[] = [];
  readonly #idempotencyKeys = new Map<string, string>();

  constructor(
    private readonly client: MustBeViralRestClient,
    private readonly runId: string,
    private readonly reviewer: string,
    private readonly createIdempotencyKey: () => string,
  ) {}

  describeVariant(input: Readonly<{ variantId: string; description: string }>): void {
    this.#groups = applyAccessibilityDescription(this.#groups, input.variantId, input.description);
  }

  async read(): Promise<ReviewReadResult> {
    try {
      const result = await this.client.request('get_receipt', { id: this.runId });
      if ('error' in result) return this.#mapError(result.error, this.runId);
      const [runContext, extras] = await Promise.all([
        this.#runContext(),
        loadReviewExtras(this.client, result.data.receipt.artifacts),
      ]);
      const mapped = reviewFromReceipt(
        result.data.receipt,
        this.reviewer,
        extras,
        runContext.nodeKeys,
      );
      const campaignName = await this.#campaignName(result.data.receipt.run.project_id);
      this.#groups = mapped.groups;
      return {
        type: 'ok',
        ...mapped,
        summary: {
          ...mapped.summary,
          ...(runContext.settlement === null
            ? {}
            : {
                quotedMicros: runContext.settlement.reservationMicros,
                authorizedMicros: runContext.settlement.reservationMicros,
                capturedMicros: runContext.settlement.capturedMicros,
                releasedMicros: runContext.settlement.releasedMicros,
                refundedMicros: runContext.settlement.refundedMicros,
                pendingMicros: runContext.settlement.pendingMicros,
                netMicros: runContext.settlement.netMicros,
                settlementStatus: runContext.settlement.settlementStatus,
                budgetUsedMicros: runContext.settlement.capturedMicros,
                budgetCapMicros: runContext.settlement.reservationMicros,
              }),
          campaignName,
          recovery: runContext.recovery,
        },
      };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return { type: 'error', message: 'Core could not read review artifacts.', retryable: true };
    }
  }

  async decideVariant(
    input: Readonly<{
      variantId: string;
      decision: Exclude<ReviewDecision, 'pending'>;
      reason?: string;
      expectedRevisionId: string;
    }>,
  ): Promise<ReviewPortResult> {
    const variant = this.#groups
      .flatMap((group) => group.variants)
      .find((candidate) => candidate.id === input.variantId);
    if (variant === undefined) return { type: 'not_found', artifact_id: input.variantId };
    const revision = this.#groups.find((group) => group.id === variant.groupId)?.revision;
    if (revision !== input.expectedRevisionId) {
      return { type: 'conflict', actual_revision_id: revision ?? 'current revision' };
    }
    if (input.decision === 'rejected') {
      if (!input.reason?.trim()) return { type: 'reason_required', variant_id: input.variantId };
      this.#groups = this.#updateDecisions([input.variantId], 'rejected', input.reason.trim());
      return { type: 'ok', groups: this.#groups };
    }
    return this.#approve([variant]);
  }

  async approveGroup(
    input: Readonly<{ groupId: string; reviewer: string; expectedRevisionId: string }>,
  ): Promise<ReviewPortResult> {
    const group = this.#groups.find((candidate) => candidate.id === input.groupId);
    if (group === undefined) return { type: 'not_found', artifact_id: input.groupId };
    if (group.revision !== input.expectedRevisionId) {
      return { type: 'conflict', actual_revision_id: group.revision };
    }
    return this.#approve(group.variants.filter((variant) => variant.decision !== 'rejected'));
  }

  async approveMembers(
    input: Readonly<{ variantIds: readonly string[]; expectedRevisionId: string }>,
  ): Promise<ReviewPortResult> {
    const selected = new Set(input.variantIds);
    const members = this.#groups
      .flatMap((group) => group.variants)
      .filter((variant) => selected.has(variant.id) && variant.decision !== 'rejected');
    if (members.length === 0) return { type: 'not_found', artifact_id: input.variantIds[0] ?? '' };
    const revision = this.#groups.find((group) =>
      group.variants.some((variant) => selected.has(variant.id)),
    )?.revision;
    if (revision !== input.expectedRevisionId) {
      return { type: 'conflict', actual_revision_id: revision ?? 'current revision' };
    }
    return this.#approve(members);
  }

  async #approve(variants: readonly ReviewVariant[]): Promise<ReviewPortResult> {
    if (variants.length === 0) {
      return {
        type: 'error',
        message: 'At least one non-rejected artifact is required for approval.',
        retryable: false,
      };
    }
    const missing = variants.find((variant) => !variant.accessibilityDescription?.trim());
    if (missing !== undefined) return { type: 'description_required', artifact_id: missing.id };
    const signature = variants
      .map(({ id }) => id)
      .sort()
      .join(':');
    try {
      const result = await this.client.request('approve_artifacts', {
        id: this.runId,
        idempotencyKey: this.#idempotencyKey(signature),
        body: {
          approvals: variants.map((variant) => ({
            artifact_id: variant.id,
            accessibility_description: variant.accessibilityDescription ?? '',
          })),
        },
      });
      if ('error' in result) return this.#mapError(result.error, this.runId, false);
      this.#groups = this.#updateDecisions(
        result.data.artifacts.map(({ artifact_id }) => artifact_id),
        'approved',
      );
      return { type: 'ok', groups: this.#groups };
    } catch (error) {
      if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
      return { type: 'error', message: 'Core could not record this approval.', retryable: false };
    }
  }

  #updateDecisions(
    artifactIds: readonly string[],
    decision: 'approved' | 'rejected',
    reason?: string,
  ): readonly ArtifactGroupReview[] {
    const selected = new Set(artifactIds);
    return this.#groups.map((group) => {
      const variants = group.variants.map((variant) =>
        selected.has(variant.id)
          ? {
              ...variant,
              decision,
              ...(decision === 'rejected' && reason !== undefined
                ? { rejectionReason: reason }
                : {}),
            }
          : variant,
      );
      return {
        ...group,
        variants,
        decision: variants.every((variant) => variant.decision === 'approved')
          ? 'approved'
          : 'pending',
      };
    });
  }

  async #campaignName(projectId: string): Promise<string | null> {
    try {
      const project = await this.client.request('get_project', { id: projectId });
      if ('error' in project) {
        if (isSessionExpiredFailure(project.error)) throw project.error;
        return null;
      }
      return project.data.project.name;
    } catch (error) {
      if (isSessionExpiredFailure(error)) throw error;
      return null;
    }
  }

  async #runContext(): Promise<
    Readonly<{
      nodeKeys: Readonly<Record<string, string>>;
      recovery: RunRecoveryView | null;
      settlement: RunSettlementView | null;
    }>
  > {
    try {
      const run = await this.client.request('get_run', { id: this.runId });
      if ('error' in run) {
        if (isSessionExpiredFailure(run.error)) throw run.error;
        return { nodeKeys: {}, recovery: null, settlement: null };
      }
      return {
        nodeKeys: Object.fromEntries(run.data.nodes.map((node) => [node.runNodeId, node.nodeKey])),
        recovery: runRecoveryView(run.data),
        settlement: runSettlementView(run.data),
      };
    } catch (error) {
      if (isSessionExpiredFailure(error)) throw error;
      return { nodeKeys: {}, recovery: null, settlement: null };
    }
  }

  #idempotencyKey(signature: string): string {
    const existing = this.#idempotencyKeys.get(signature);
    if (existing !== undefined) return existing;
    const created = this.createIdempotencyKey();
    this.#idempotencyKeys.set(signature, created);
    return created;
  }

  #mapError(
    error: Readonly<{
      code: string;
      message: string;
      request_id: string;
      retryable: boolean;
      details?: Readonly<Record<string, unknown>> | undefined;
    }>,
    resourceId: string,
    allowRetry = true,
  ): Exclude<ReviewPortResult, { type: 'ok' | 'reason_required' | 'description_required' }> {
    if (isSessionExpiredFailure(error)) return SESSION_EXPIRED_RESULT;
    if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
    if (error.code === 'NOT_FOUND') return { type: 'not_found', artifact_id: resourceId };
    if (error.code === 'RUN_NOT_APPROVABLE') {
      return { type: 'conflict', actual_revision_id: 'run state' };
    }
    return {
      type: 'error',
      message: error.message,
      retryable: allowRetry && error.retryable,
      request_id: error.request_id,
    };
  }
}
