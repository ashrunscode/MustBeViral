export type ReviewDecision = 'pending' | 'approved' | 'rejected';

export interface ReviewVariant {
  readonly id: string;
  readonly groupId: string;
  readonly label: string;
  readonly format: string;
  readonly model: string;
  readonly decision: ReviewDecision;
  readonly rejectionReason?: string;
}

export interface ArtifactGroupReview {
  readonly id: string;
  readonly name: string;
  readonly reviewer: string;
  readonly decision: ReviewDecision;
  readonly variants: readonly ReviewVariant[];
}

export type ReviewPortResult =
  | { readonly type: 'ok'; readonly groups: readonly ArtifactGroupReview[] }
  | { readonly type: 'reason_required'; readonly variant_id: string }
  | { readonly type: 'conflict'; readonly actual_revision_id: string }
  | { readonly type: 'not_found'; readonly artifact_id: string };

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
    variants: [
      {
        id: 'hero-a',
        groupId: 'visuals',
        label: 'Hero A',
        format: '1080 x 1350',
        model: 'flux-2-klein',
        decision: 'approved',
      },
      {
        id: 'hero-b',
        groupId: 'visuals',
        label: 'Hero B',
        format: '1080 x 1350',
        model: 'flux-2-klein',
        decision: 'pending',
      },
      {
        id: 'story-a',
        groupId: 'visuals',
        label: 'Story A',
        format: '1080 x 1920',
        model: 'flux-2-klein',
        decision: 'pending',
      },
    ],
  },
  {
    id: 'copy',
    name: 'Copy system',
    reviewer: 'Maya Chen',
    decision: 'pending',
    variants: [
      {
        id: 'copy-a',
        groupId: 'copy',
        label: 'Launch copy A',
        format: '3 placements',
        model: 'kimi-2.6',
        decision: 'pending',
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
