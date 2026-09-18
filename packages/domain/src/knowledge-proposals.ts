import {
  assertionKinds,
  isUntrustedInstruction,
  type AssertionKind,
  type RepresentativeAssertion,
} from './representative-extract';

export const proposalKinds = ['voice', 'audience', 'positioning'] as const;
export const proposalStatuses = ['observed', 'inferred', 'unknown', 'corrected'] as const;
export const proposalConfidence = ['low', 'medium', 'high'] as const;
export const questionStatuses = ['open', 'answered'] as const;

export type ProposalKind = (typeof proposalKinds)[number];
export type ProposalStatus = (typeof proposalStatuses)[number];
export type ProposalConfidence = (typeof proposalConfidence)[number];
export type QuestionStatus = (typeof questionStatuses)[number];

export interface BrandProposal {
  readonly kind: ProposalKind;
  readonly status: Exclude<ProposalStatus, 'corrected'>;
  readonly value_text: string | null;
  readonly confidence: ProposalConfidence | null;
  readonly evidence_field_keys: readonly string[];
  readonly excerpt: string;
}

export interface BrandKnowledgeQuestion {
  readonly prompt: string;
  readonly target_kind: AssertionKind | ProposalKind;
  readonly excerpt: string;
}

function currentOf(kind: AssertionKind, items: readonly RepresentativeAssertion[]) {
  return items.filter((item) => item.kind === kind && item.status !== 'unknown');
}

function evidenceKeys(items: readonly RepresentativeAssertion[]): string[] {
  return items.map((item) => item.field_key).slice(0, 8);
}

export function proposeBrandKnowledge(
  assertions: readonly RepresentativeAssertion[],
): readonly BrandProposal[] {
  const language = currentOf('language', assertions).filter(
    (item) => item.value_text !== null && !isUntrustedInstruction(item.value_text),
  );
  const offerings = currentOf('offering', assertions);
  const facts = currentOf('fact', assertions);
  const audienceFacts = facts.filter((item) => item.field_key === 'audience');

  const voice: BrandProposal =
    language.length > 0
      ? {
          kind: 'voice',
          status: 'observed',
          value_text: language[0]!.value_text,
          confidence: 'medium',
          evidence_field_keys: evidenceKeys(language),
          excerpt: language[0]!.excerpt,
        }
      : {
          kind: 'voice',
          status: 'unknown',
          value_text: null,
          confidence: null,
          evidence_field_keys: [],
          excerpt: 'No voice evidence was supplied.',
        };

  const audience: BrandProposal =
    audienceFacts.length > 0
      ? {
          kind: 'audience',
          status: 'inferred',
          value_text: audienceFacts[0]!.value_text,
          confidence: 'low',
          evidence_field_keys: evidenceKeys(audienceFacts),
          excerpt: audienceFacts[0]!.excerpt,
        }
      : {
          kind: 'audience',
          status: 'unknown',
          value_text: null,
          confidence: null,
          evidence_field_keys: [],
          excerpt: 'Audience remains unknown. No demographic was assumed.',
        };

  const positioning: BrandProposal =
    offerings.length > 0
      ? {
          kind: 'positioning',
          status: 'inferred',
          value_text: offerings.map((item) => item.value_text).join('; '),
          confidence: 'low',
          evidence_field_keys: evidenceKeys(offerings),
          excerpt: offerings[0]!.excerpt,
        }
      : {
          kind: 'positioning',
          status: 'unknown',
          value_text: null,
          confidence: null,
          evidence_field_keys: [],
          excerpt: 'Positioning remains unknown until offerings are observed.',
        };

  return [voice, audience, positioning];
}

export function targetedKnowledgeQuestions(
  assertions: readonly RepresentativeAssertion[],
  proposals: readonly BrandProposal[],
): readonly BrandKnowledgeQuestion[] {
  const questions: BrandKnowledgeQuestion[] = [];
  for (const kind of assertionKinds) {
    const missing = assertions.every((item) => item.kind !== kind || item.status === 'unknown');
    if (!missing) continue;
    const prompt =
      kind === 'offering'
        ? 'Which services or products should this brand advertise?'
        : kind === 'location'
          ? 'Where does this brand operate?'
          : kind === 'fact'
            ? 'Which operating facts should stay on the record?'
            : kind === 'offer'
              ? 'Which current offer, if any, may be stated, and when does it end?'
              : kind === 'visual_candidate'
                ? 'Which source image is only a visual candidate, not a reusable campaign asset?'
                : 'Which language should approved copy use?';
    questions.push({
      prompt,
      target_kind: kind,
      excerpt: `Missing ${kind.replaceAll('_', ' ')}.`,
    });
  }
  for (const proposal of proposals) {
    if (proposal.status !== 'unknown') continue;
    questions.push({
      prompt:
        proposal.kind === 'audience'
          ? "Who is this offering for, in the operator's words?"
          : proposal.kind === 'voice'
            ? 'Which existing phrases should future copy sound like?'
            : 'How should this brand be positioned against alternatives?',
      target_kind: proposal.kind,
      excerpt: proposal.excerpt,
    });
  }
  return questions.slice(0, 20);
}
