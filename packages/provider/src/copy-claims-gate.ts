import { ProviderError } from './errors';

/**
 * Mechanical claims gate for generated copy.
 *
 * The WashBodega trial established that a model's own "Compliance notes" carry no evidentiary
 * weight: two candidates, including the one selected for launch, attested to constraints they had
 * not satisfied (evidence:
 * governance/evidence/WP-P0-001/openrouter-blind-eval/washbodega-trial/decision.md). Self-reporting
 * is therefore treated as a drafting aid, and every prohibited-claim constraint a brief declares is
 * re-checked here against the copy that will actually reach a customer.
 */

export interface ProhibitedClaimRule {
  readonly id: string;
  readonly pattern: RegExp;
  readonly description: string;
}

/**
 * "If this appears, that must appear too."
 *
 * Earned from measured output rather than imagined: a real published price is only true with the
 * condition attached to it. The trial produced copy quoting $1.29/lb without its 15 lb minimum,
 * and copy promising late hours on "Saturday" when the store is open late Friday *and* Saturday.
 * Neither is a false statement in isolation, which is precisely why a prohibition list cannot
 * catch them.
 */
export interface ConditionalRequirement {
  readonly id: string;
  /** When this matches the copy... */
  readonly when: RegExp;
  /** ...this must also match, or the copy is incomplete. */
  readonly require: RegExp;
  readonly description: string;
}

export interface CopyClaimsPolicy {
  /** Brief-derived prohibitions, e.g. "no price may appear in this campaign". */
  readonly prohibited: readonly ProhibitedClaimRule[];
  /** Strings a brief locks to exact wording, e.g. a registered tagline. Compared verbatim. */
  readonly requiredVerbatim?: readonly string[];
  /** Facts that may not travel without their qualifying condition. */
  readonly conditional?: readonly ConditionalRequirement[];
}

export interface CopyClaimsViolation {
  readonly ruleId: string;
  readonly description: string;
  readonly evidence: string;
}

/**
 * Defects that make a deliverable unusable regardless of which brief it was written against.
 * All three were observed in real trial output rather than imagined.
 */
export const COPY_DELIVERABILITY_RULES: readonly ProhibitedClaimRule[] = [
  {
    id: 'leaked_authoring_commentary',
    pattern: /\((?:self-)?correction:|note to self|if space permits|i will add|let'?s adjust/iu,
    description: 'authoring commentary leaked into customer-facing copy',
  },
  {
    id: 'stage_direction',
    pattern: /\((?:linking to|link to|insert|placeholder|tbd)\b[^)]*\)/iu,
    description: 'stage direction left in place of finished copy',
  },
  {
    id: 'code_fence',
    pattern: /```/u,
    description: 'copy wrapped in a code fence rather than delivered as prose',
  },
];

/**
 * Removes model-authored compliance notes before scanning.
 *
 * Required for correctness, not tidiness: a model that correctly writes "no dry cleaning claimed"
 * in its notes must not be scored as having claimed dry cleaning. Scanning the full document was
 * measured to produce false positives on every candidate in the trial.
 */
export function stripModelAuthoredComplianceNotes(markdown: string): string {
  return markdown.replace(
    /(^|\n)[^\n]*\*{0,2}compliance\s+notes?\*{0,2}[^\n]*\n[\s\S]*?(?=\n\s*(?:\*\*\*|---|#{1,4}\s|\*\*(?:ad )?(?:copy )?set)|\s*$)/giu,
    '\n',
  );
}

/** Rules may be authored with /g, whose lastIndex would otherwise persist between calls. */
function stateless(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, pattern.flags.replace(/g/gu, ''));
}

export function findCopyClaimsViolations(
  markdown: string,
  policy: CopyClaimsPolicy,
): readonly CopyClaimsViolation[] {
  const copy = stripModelAuthoredComplianceNotes(markdown);
  const violations: CopyClaimsViolation[] = [];

  for (const rule of [...COPY_DELIVERABILITY_RULES, ...policy.prohibited]) {
    const match = copy.match(stateless(rule.pattern));
    if (match !== null) {
      violations.push({
        ruleId: rule.id,
        description: rule.description,
        evidence: match[0].trim().slice(0, 120),
      });
    }
  }

  for (const required of policy.requiredVerbatim ?? []) {
    if (!copy.includes(required)) {
      violations.push({
        ruleId: 'required_verbatim_missing',
        description: 'brief locks this wording to an exact string',
        evidence: required,
      });
    }
  }

  for (const rule of policy.conditional ?? []) {
    const trigger = copy.match(stateless(rule.when));
    if (trigger === null) continue;
    if (stateless(rule.require).test(copy)) continue;
    violations.push({
      ruleId: rule.id,
      description: rule.description,
      evidence: trigger[0].trim().slice(0, 120),
    });
  }

  return violations;
}

/**
 * Fails closed: copy that violates a brief constraint is never returned to a caller, because the
 * downstream artifact is what a customer publishes under their own brand.
 */
export function assertCopyClaimsPolicyHonored(markdown: string, policy: CopyClaimsPolicy): void {
  const violations = findCopyClaimsViolations(markdown, policy);
  if (violations.length === 0) return;
  throw new ProviderError(
    'payload_invalid',
    `Generated copy violates ${String(violations.length)} brief constraint(s): ${violations
      .map((violation) => violation.ruleId)
      .join(', ')}`,
    false,
    { reason: 'copy_claims_policy_violated', violations },
  );
}
