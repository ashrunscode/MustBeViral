import { z } from 'zod';

const requiredText = (message: string) => z.string().trim().min(1, message);

export const BriefDraftSchema = z.object({
  productTruth: z.object({
    productName: requiredText('Add the product name.'),
    category: requiredText('Add the product category.'),
    features: requiredText('Add at least one product feature.'),
    benefits: requiredText('Add at least one supported benefit.'),
    evidence: requiredText('Add product evidence.'),
    approvedFacts: requiredText('Add approved product facts.'),
  }),
  brandKit: z.object({
    colors: requiredText('Add the approved brand colors.'),
    typography: requiredText('Add the approved typography.'),
    tone: requiredText('Add the brand tone.'),
    visualRules: requiredText('Add the visual rules.'),
    examples: requiredText('Add a brand example.'),
    prohibitedTreatments: requiredText('Add prohibited brand treatments.'),
  }),
  audience: z.object({
    targetAudience: requiredText('Define the target audience.'),
    awarenessStage: requiredText('Choose an awareness stage.'),
    painPoints: requiredText('Add audience pain points.'),
    desires: requiredText('Add audience desires.'),
    objections: requiredText('Add audience objections.'),
  }),
  offer: z.object({
    pricePresentation: requiredText('Add the price presentation.'),
    urgencyConstraints: requiredText('Define urgency constraints.'),
    destinationUrl: z.url({ error: 'Add a valid destination URL.' }),
  }),
  claimsLegal: z.object({
    approvedClaims: requiredText('Add approved factual claims.'),
    evidenceSource: requiredText('Add a source for “Dermatologist tested”.'),
    legalCopy: requiredText('Add required legal copy.'),
    prohibitedClaims: z
      .array(z.string().trim().min(1))
      .min(1, 'Add at least one prohibited claim.'),
    creativeConstraints: requiredText('Add the creative constraints.'),
  }),
  assets: z.object({
    packshots: z.array(z.string().trim().min(1)).min(1, 'Add at least one product packshot.'),
    squarePackshotReady: z.boolean().refine((value) => value, {
      message: 'Add one square product packshot.',
    }),
    rightsAttested: z.boolean().refine((value) => value, {
      message: 'Asset-rights attestation is required.',
    }),
  }),
});

export type BriefDraft = z.infer<typeof BriefDraftSchema>;

export const lumenSkinDraft: BriefDraft = {
  productTruth: {
    productName: 'Lumen Skin Barrier Serum',
    category: 'Sensitive-skin facial serum',
    features: 'Fragrance-free; lightweight; 30 ml pump bottle',
    benefits: 'Supports the skin’s moisture barrier',
    evidence: 'Supplied perception study and formulation dossier',
    approvedFacts: 'Dermatologist tested. Fragrance-free. Formulated for sensitive skin.',
  },
  brandKit: {
    colors: 'Cobalt, fog white, pale blue',
    typography: 'Calm sans with restrained serif accents',
    tone: 'Clinical-calm, direct, reassuring',
    visualRules: 'Soft daylight, clean product texture, generous negative space',
    examples: 'Lumen Skin launch lookbook, pages 4–9',
    prohibitedTreatments: 'No water-splash clichés or clinical-office imagery',
  },
  audience: {
    targetAudience: 'Ingredient-aware adults with sensitive, dry-feeling skin',
    awarenessStage: 'Problem aware',
    painPoints: 'Overcomplicated routines and harsh-feeling formulas',
    desires: 'A calm, credible daily ritual',
    objections: 'Concern about irritation and unsupported skincare promises',
  },
  offer: {
    pricePresentation: '$42 · free shipping over $60',
    urgencyConstraints: 'No countdowns, false scarcity, or pressure language',
    destinationUrl: 'https://example.com/products/barrier-serum',
  },
  claimsLegal: {
    approvedClaims: 'Dermatologist tested. Fragrance-free. Formulated for sensitive skin.',
    evidenceSource: '',
    legalCopy: 'Results vary. Patch test before first use.',
    prohibitedClaims: ['Cures acne', 'Medical grade', 'Guaranteed results', 'Clinically proven'],
    creativeConstraints:
      'Do not imply disease treatment, guaranteed outcomes, or before/after results.',
  },
  assets: {
    packshots: ['front-packshot.png', 'pump-detail.png', 'texture-swatch.png', 'carton-side.png'],
    squarePackshotReady: false,
    rightsAttested: false,
  },
};

export interface BriefDraftPort {
  load(workspace: string): Promise<BriefDraft | null>;
  save(workspace: string, draft: BriefDraft): Promise<void>;
}

export class InMemoryBriefDraftPort implements BriefDraftPort {
  readonly #drafts = new Map<string, BriefDraft>();

  async load(workspace: string) {
    return this.#drafts.get(workspace) ?? null;
  }

  async save(workspace: string, draft: BriefDraft) {
    this.#drafts.set(workspace, structuredClone(draft));
  }
}
