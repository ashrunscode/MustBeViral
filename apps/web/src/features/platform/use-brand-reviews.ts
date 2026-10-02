'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { platformRequest } from './platform-client';

export type BrandRecord = PlatformOutput<'get_brand'>['record'];
export type KnowledgeReview = PlatformOutput<'get_knowledge_review'>;

export interface BrandReview {
  readonly brand: BrandRecord;
  readonly review: KnowledgeReview | null;
  readonly error: unknown;
}

/** How many brands the studio sections read in one pass; the rest are named, not guessed. */
export const BRAND_REVIEW_LIMIT = 12;

/**
 * Reads each brand's knowledge review so studio sections can list real open questions and
 * approvable drafts. A failed brand keeps its error instead of pretending to be clear.
 */
export function useBrandReviews(brands: readonly BrandRecord[] | undefined) {
  const [state, setState] = useState<{
    key: string;
    reviews: readonly BrandReview[];
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const ids = `${attempt}|${(brands ?? [])
    .slice(0, BRAND_REVIEW_LIMIT)
    .map((brand) => `${brand.workspace_id}:${brand.id}:${brand.version}`)
    .join(',')}`;
  useEffect(() => {
    if (brands === undefined) return;
    let current = true;
    const subset = brands.slice(0, BRAND_REVIEW_LIMIT);
    void Promise.all(
      subset.map(async (brand): Promise<BrandReview> => {
        try {
          const review = await platformRequest('get_knowledge_review', {
            workspace_id: brand.workspace_id,
            brand_id: brand.id,
          });
          return { brand, review, error: undefined };
        } catch (error) {
          return { brand, review: null, error };
        }
      }),
    ).then((reviews) => {
      if (current) setState({ key: ids, reviews });
    });
    return () => {
      current = false;
    };
    // `ids` is the stable identity of the brand list; brands itself changes identity per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, brands === undefined]);
  const matching = state?.key === ids ? state.reviews : undefined;
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  return {
    reviews: matching,
    loading: brands !== undefined && matching === undefined,
    truncated: (brands?.length ?? 0) > BRAND_REVIEW_LIMIT,
    refresh,
  };
}

export function openQuestions(review: KnowledgeReview | null) {
  return review?.current_questions.filter((question) => question.status === 'open') ?? [];
}

/** A draft that exists, has a hash, is not awaiting extraction and has no open question. */
export function draftIsApprovable(review: KnowledgeReview | null): boolean {
  if (review === null || review.record === null || review.draft_hash === null) return false;
  if (review.extract_pending) return false;
  if (openQuestions(review).length > 0) return false;
  if (review.current_assertions.length === 0 && review.current_proposals.length === 0) return false;
  // Nothing new to approve when the approved version already carries this draft.
  return review.approved_version?.draft_hash !== review.draft_hash;
}
