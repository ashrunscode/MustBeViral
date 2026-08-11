import type { MustBeViralRestClient, P0OperationData } from '@mustbeviral/contracts';

export type ReviewDecision = 'pending' | 'approved' | 'rejected';

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
}

export interface ArtifactGroupReview {
  readonly id: string;
  readonly name: string;
  readonly reviewer: string;
  readonly decision: ReviewDecision;
  readonly variants: readonly ReviewVariant[];
  readonly revision: string;
}

export interface ReviewSummary {
  readonly quotedMicros: bigint;
  readonly capturedMicros: bigint;
  readonly budgetUsedMicros: bigint;
  readonly budgetCapMicros: bigint;
  readonly exportReady: boolean;
  readonly qaNoteCount: number;
  readonly route: string;
}

export type ReviewPortResult =
  | { readonly type: 'ok'; readonly groups: readonly ArtifactGroupReview[] }
  | { readonly type: 'reason_required'; readonly variant_id: string }
  | { readonly type: 'conflict'; readonly actual_revision_id: string }
  | { readonly type: 'not_found'; readonly artifact_id: string }
  | { readonly type: 'description_required'; readonly artifact_id: string }
  | { readonly type: 'forbidden' }
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
}

export interface ReviewPort {
  read(): readonly ArtifactGroupReview[];
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
  #groups = goldenGroups.map((group) => ({
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

function groupKind(mimeType: string) {
  if (mimeType.startsWith('image/')) return { id: 'visuals', name: 'Visual system' };
  if (mimeType.startsWith('video/')) return { id: 'motion', name: 'Motion system' };
  return { id: 'copy', name: 'Copy system' };
}

function metadataRoute(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const record = value as Readonly<Record<string, unknown>>;
  for (const key of ['provider_model_id', 'model_route_id', 'model', 'provider']) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.length > 0) return candidate;
  }
  return undefined;
}

function reviewFromReceipt(
  receipt: P0OperationData<'get_receipt'>['receipt'],
  reviewer: string,
): Readonly<{ groups: readonly ArtifactGroupReview[]; summary: ReviewSummary }> {
  const reviewable = receipt.artifacts.filter(
    (artifact) =>
      artifact.artifact_kind === 'provider_output' || artifact.artifact_kind === 'approved_output',
  );
  const groups = new Map<string, ArtifactGroupReview>();
  for (const [index, artifact] of reviewable.entries()) {
    const kind = groupKind(artifact.mime_type);
    const current = groups.get(kind.id);
    const variant: ReviewVariant = {
      id: artifact.id,
      groupId: kind.id,
      label: `Artifact ${String(index + 1).padStart(2, '0')}`,
      format: `${artifact.mime_type} · ${String(artifact.byte_size)} bytes`,
      model: metadataRoute(artifact.rights_attestation) ?? 'Receipt lineage',
      decision: artifact.artifact_kind === 'approved_output' ? 'approved' : 'pending',
      accessibilityDescription: artifact.accessibility_description,
      hasPrior: receipt.lineage.some(({ child_artifact_id }) => child_artifact_id === artifact.id),
    };
    const variants = [...(current?.variants ?? []), variant];
    groups.set(kind.id, {
      id: kind.id,
      name: kind.name,
      reviewer: artifact.approved_by === null ? reviewer : `Approved by ${artifact.approved_by}`,
      decision: variants.every((candidate) => candidate.decision === 'approved')
        ? 'approved'
        : 'pending',
      revision: receipt.run.canvas_revision_id,
      variants,
    });
  }
  const routes = [
    ...new Set(receipt.ledger.map(({ metadata }) => metadataRoute(metadata)).filter(Boolean)),
  ];
  return {
    groups: [...groups.values()],
    summary: {
      quotedMicros: BigInt(receipt.reservation?.amount_micros ?? 0),
      capturedMicros: BigInt(receipt.reservation?.captured_micros ?? 0),
      budgetUsedMicros: BigInt(receipt.reservation?.captured_micros ?? 0),
      budgetCapMicros: BigInt(receipt.reservation?.amount_micros ?? 0),
      exportReady: receipt.artifacts.some((artifact) => artifact.artifact_kind === 'export'),
      qaNoteCount: 0,
      route: routes.join(' + ') || 'Receipt lineage',
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

  async read(): Promise<ReviewReadResult> {
    try {
      const result = await this.client.request('get_receipt', { id: this.runId });
      if ('error' in result) return this.#mapError(result.error, this.runId);
      const mapped = reviewFromReceipt(result.data.receipt, this.reviewer);
      this.#groups = mapped.groups;
      return { type: 'ok', ...mapped };
    } catch {
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
      if ('error' in result) return this.#mapError(result.error, this.runId);
      this.#groups = this.#updateDecisions(
        result.data.artifacts.map(({ artifact_id }) => artifact_id),
        'approved',
      );
      return { type: 'ok', groups: this.#groups };
    } catch {
      return { type: 'error', message: 'Core could not record this approval.', retryable: true };
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
  ): Exclude<ReviewPortResult, { type: 'ok' | 'reason_required' | 'description_required' }> {
    if (error.code === 'FORBIDDEN') return { type: 'forbidden' };
    if (error.code === 'NOT_FOUND') return { type: 'not_found', artifact_id: resourceId };
    if (error.code === 'RUN_NOT_APPROVABLE') {
      return { type: 'conflict', actual_revision_id: 'run state' };
    }
    return {
      type: 'error',
      message: error.message,
      retryable: error.retryable,
      request_id: error.request_id,
    };
  }
}
