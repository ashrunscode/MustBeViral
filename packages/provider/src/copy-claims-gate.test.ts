import { describe, expect, it } from 'vitest';

import {
  assertCopyClaimsPolicyHonored,
  findCopyClaimsViolations,
  stripModelAuthoredComplianceNotes,
  type CopyClaimsPolicy,
} from './copy-claims-gate';
import { ProviderError } from './errors';

// Mirrors a real brief: WashBodega publishes no prices, so any price is a claims violation.
const NO_PRICE_POLICY: CopyClaimsPolicy = {
  prohibited: [
    {
      id: 'price',
      pattern: /\$\s?\d|\bper pound\b|\d+\s?%/u,
      description: 'brief forbids stating any price',
    },
  ],
  requiredVerbatim: ['Your Neighborhood Laundry.'],
};

const CLEAN_COPY = [
  '**Hook:** Drop it off. Get your day back.',
  '**Primary text:** We wash, dry, and fold. Your Neighborhood Laundry.',
  '**CTA:** Get Directions',
].join('\n');

describe('stripModelAuthoredComplianceNotes', () => {
  it('does not flag a prohibited term that appears only in the model’s own notes', () => {
    // Regression for a measured false positive: every trial candidate correctly wrote
    // "no dry cleaning claimed" in its notes and was wrongly scored as claiming dry cleaning.
    const withNotes = [
      CLEAN_COPY,
      '',
      '**Compliance notes:**',
      '- Honors prohibition on stating prices: no $ figure appears.',
      '- Honors prohibition on dry cleaning claims.',
    ].join('\n');

    expect(findCopyClaimsViolations(withNotes, NO_PRICE_POLICY)).toEqual([]);
  });

  it('keeps the customer-facing copy intact when notes are removed', () => {
    const stripped = stripModelAuthoredComplianceNotes(
      `${CLEAN_COPY}\n\n**Compliance notes:**\n- Uses approved facts only.\n`,
    );
    expect(stripped).toContain('Get your day back');
    expect(stripped).not.toContain('Uses approved facts only');
  });
});

describe('findCopyClaimsViolations', () => {
  it('flags a price that reaches the customer-facing copy', () => {
    const violations = findCopyClaimsViolations(
      '**Primary text:** Wash and fold from $1.75 per pound. Your Neighborhood Laundry.',
      NO_PRICE_POLICY,
    );
    expect(violations.map((violation) => violation.ruleId)).toContain('price');
  });

  it('flags locked wording that is missing or altered', () => {
    // "Your Neighborhood Laundry" without the terminal period is not the locked tagline.
    const violations = findCopyClaimsViolations(
      '**Headline:** Your Neighborhood Laundry - Where Community Matters',
      NO_PRICE_POLICY,
    );
    expect(violations.map((violation) => violation.ruleId)).toContain('required_verbatim_missing');
  });

  it('flags leaked authoring commentary observed in real trial output', () => {
    const violations = findCopyClaimsViolations(
      '**Primary text:** Wash and dry done for you. Your Neighborhood Laundry. ' +
        '(Self-correction: I will add the tagline if space permits.)',
      NO_PRICE_POLICY,
    );
    expect(violations.map((violation) => violation.ruleId)).toContain(
      'leaked_authoring_commentary',
    );
  });

  it('flags a stage direction left in place of a finished CTA', () => {
    const violations = findCopyClaimsViolations(
      `${CLEAN_COPY}\n**CTA:** Learn More (Linking to Hours/Location)`,
      NO_PRICE_POLICY,
    );
    expect(violations.map((violation) => violation.ruleId)).toContain('stage_direction');
  });

  it('flags copy delivered inside a code fence', () => {
    const violations = findCopyClaimsViolations(
      '```markdown\n' + CLEAN_COPY + '\n```',
      NO_PRICE_POLICY,
    );
    expect(violations.map((violation) => violation.ruleId)).toContain('code_fence');
  });

  it('passes copy that honours every constraint', () => {
    expect(findCopyClaimsViolations(CLEAN_COPY, NO_PRICE_POLICY)).toEqual([]);
  });

  it('does not leak regex state between calls when a rule carries the global flag', () => {
    const policy: CopyClaimsPolicy = {
      prohibited: [{ id: 'sale', pattern: /sale/gu, description: 'no discount framing' }],
    };
    const copy = '**Hook:** Big sale today';
    expect(findCopyClaimsViolations(copy, policy)).toHaveLength(1);
    expect(findCopyClaimsViolations(copy, policy)).toHaveLength(1);
  });
});

describe('conditional requirements', () => {
  // Both cases below are real defects measured in trial output against WashBodega's published
  // pricing, where the statement is true in isolation and misleading without its condition.
  const POLICY: CopyClaimsPolicy = {
    prohibited: [],
    conditional: [
      {
        id: 'per_pound_price_without_minimum',
        when: /\$1\.29\s*(per pound|\/\s?lb)/iu,
        require: /15\s?lb/iu,
        description: 'a per-pound price must carry its stated minimum',
      },
      {
        id: 'late_hours_without_both_days',
        when: /1:00\s?AM/iu,
        require: /friday/iu,
        description: 'late closing applies to Friday and Saturday, not Saturday alone',
      },
    ],
  };

  it('flags a per-pound price quoted without its minimum', () => {
    const violations = findCopyClaimsViolations(
      '**Primary text:** Wash, Dry & Fold is $1.29 per pound. Drop it off today.',
      POLICY,
    );
    expect(violations.map((v) => v.ruleId)).toEqual(['per_pound_price_without_minimum']);
  });

  it('accepts the same price when the minimum travels with it', () => {
    expect(
      findCopyClaimsViolations(
        '**Primary text:** Wash, Dry & Fold is $1.29 per pound with a 15 lb minimum.',
        POLICY,
      ),
    ).toEqual([]);
  });

  it('flags late hours attributed to Saturday alone', () => {
    const violations = findCopyClaimsViolations(
      '**Primary text:** Open daily 7:00 AM to 11:00 PM, Saturday until 1:00 AM.',
      POLICY,
    );
    expect(violations.map((v) => v.ruleId)).toEqual(['late_hours_without_both_days']);
  });

  it('stays silent when the triggering fact is absent', () => {
    expect(findCopyClaimsViolations('**Primary text:** Drop it off. We fold.', POLICY)).toEqual([]);
  });
});

describe('assertCopyClaimsPolicyHonored', () => {
  it('returns silently for compliant copy', () => {
    expect(() => {
      assertCopyClaimsPolicyHonored(CLEAN_COPY, NO_PRICE_POLICY);
    }).not.toThrow();
  });

  it('throws a non-retryable ProviderError naming every violated rule', () => {
    let thrown: unknown;
    try {
      assertCopyClaimsPolicyHonored('```\nHalf off, only $9 today!\n```', NO_PRICE_POLICY);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ProviderError);
    const error = thrown as ProviderError;
    expect(error.retryable).toBe(false);
    // Retrying an identical request cannot fix a brief violation, so it must not be retryable.
    expect(error.message).toContain('price');
    expect(error.message).toContain('code_fence');
    expect(error.message).toContain('required_verbatim_missing');
  });
});
