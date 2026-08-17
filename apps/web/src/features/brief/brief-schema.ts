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
    evidenceSource: requiredText('Add a source for every approved claim.'),
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

export type BriefSectionId =
  'productTruth' | 'brandKit' | 'audience' | 'offer' | 'claimsLegal' | 'assets';

function filled(value: string) {
  return value.trim().length > 0;
}

export const STAGING_SYNTHETIC_PACKSHOTS = [
  'staging-front-packshot.png',
  'staging-square-packshot.png',
] as const;

export const STAGING_SYNTHETIC_PACKSHOT_PROMPT =
  'Square and front product packshots on a clean surface; product-only; no lifestyle talent; label and packaging readable.';

function packshotPromptMaterial(packshots: readonly string[]): string {
  if (
    packshots.length > 0 &&
    packshots.every((packshot) =>
      (STAGING_SYNTHETIC_PACKSHOTS as readonly string[]).includes(packshot),
    )
  ) {
    return STAGING_SYNTHETIC_PACKSHOT_PROMPT;
  }
  return packshots.join('; ');
}

export function emptyBriefDraft(): BriefDraft {
  return {
    productTruth: {
      productName: '',
      category: '',
      features: '',
      benefits: '',
      evidence: '',
      approvedFacts: '',
    },
    brandKit: {
      colors: '',
      typography: '',
      tone: '',
      visualRules: '',
      examples: '',
      prohibitedTreatments: '',
    },
    audience: {
      targetAudience: '',
      awarenessStage: '',
      painPoints: '',
      desires: '',
      objections: '',
    },
    offer: {
      pricePresentation: '',
      urgencyConstraints: '',
      destinationUrl: '',
    },
    claimsLegal: {
      approvedClaims: '',
      evidenceSource: '',
      legalCopy: '',
      prohibitedClaims: [],
      creativeConstraints: '',
    },
    assets: {
      packshots: [],
      squarePackshotReady: false,
      rightsAttested: false,
    },
  };
}

/** Worker self-session draft. Synthetic staging assets are selectable; claim chips stay editable. */
export function stagingWorkerDraft(): BriefDraft {
  return {
    ...emptyBriefDraft(),
    assets: {
      packshots: [...STAGING_SYNTHETIC_PACKSHOTS],
      squarePackshotReady: false,
      rightsAttested: false,
    },
  };
}

export function briefSectionState(
  section: BriefSectionId,
  draft: BriefDraft,
): Readonly<{ complete: boolean; meta: string }> {
  const missing = missingItemsForSection(section, draft);
  if (section === 'assets') {
    const ready = Math.min(
      5,
      draft.assets.packshots.length + Number(draft.assets.squarePackshotReady),
    );
    return {
      complete: missing.length === 0,
      meta: missing.length === 0 ? 'Complete' : `${ready} / 5 ready`,
    };
  }
  return {
    complete: missing.length === 0,
    meta: missing.length === 0 ? 'Complete' : `${String(missing.length)} missing`,
  };
}

export function briefCompletionFlags(draft: BriefDraft): readonly boolean[] {
  return [
    filled(draft.productTruth.productName) && filled(draft.productTruth.category),
    filled(draft.productTruth.features) && filled(draft.productTruth.benefits),
    filled(draft.productTruth.evidence) && filled(draft.productTruth.approvedFacts),
    filled(draft.brandKit.colors) && filled(draft.brandKit.typography),
    filled(draft.brandKit.tone) && filled(draft.brandKit.visualRules),
    filled(draft.brandKit.examples) && filled(draft.brandKit.prohibitedTreatments),
    filled(draft.audience.targetAudience) && filled(draft.audience.awarenessStage),
    filled(draft.audience.painPoints) && filled(draft.audience.desires),
    filled(draft.audience.objections),
    filled(draft.offer.pricePresentation) && filled(draft.offer.urgencyConstraints),
    /^https?:\/\//u.test(draft.offer.destinationUrl),
    filled(draft.claimsLegal.approvedClaims),
    filled(draft.claimsLegal.evidenceSource),
    filled(draft.claimsLegal.legalCopy) && draft.claimsLegal.prohibitedClaims.length > 0,
    draft.assets.packshots.length > 0,
    draft.assets.squarePackshotReady,
    draft.assets.rightsAttested,
  ];
}

export function missingBriefItems(draft: BriefDraft): readonly string[] {
  return [
    ...new Set(
      (
        [
          'productTruth',
          'brandKit',
          'audience',
          'offer',
          'claimsLegal',
          'assets',
        ] as const satisfies readonly BriefSectionId[]
      ).flatMap((section) => missingItemsForSection(section, draft)),
    ),
  ];
}

function missingItemsForSection(section: BriefSectionId, draft: BriefDraft): readonly string[] {
  if (section === 'productTruth') {
    return [
      ...(!filled(draft.productTruth.productName) ? ['Product name'] : []),
      ...(!filled(draft.productTruth.category) ? ['Category'] : []),
      ...(!filled(draft.productTruth.features) ? ['Features'] : []),
      ...(!filled(draft.productTruth.benefits) ? ['Benefits'] : []),
      ...(!filled(draft.productTruth.evidence) ? ['Product evidence'] : []),
      ...(!filled(draft.productTruth.approvedFacts) ? ['Approved facts'] : []),
    ];
  }
  if (section === 'brandKit') {
    return [
      ...(!filled(draft.brandKit.colors) ? ['Brand colors'] : []),
      ...(!filled(draft.brandKit.typography) ? ['Typography'] : []),
      ...(!filled(draft.brandKit.tone) ? ['Tone'] : []),
      ...(!filled(draft.brandKit.visualRules) ? ['Visual rules'] : []),
      ...(!filled(draft.brandKit.examples) ? ['Brand examples'] : []),
      ...(!filled(draft.brandKit.prohibitedTreatments) ? ['Prohibited treatments'] : []),
    ];
  }
  if (section === 'audience') {
    return [
      ...(!filled(draft.audience.targetAudience) ? ['Target audience'] : []),
      ...(!filled(draft.audience.awarenessStage) ? ['Awareness stage'] : []),
      ...(!filled(draft.audience.painPoints) ? ['Pain points'] : []),
      ...(!filled(draft.audience.desires) ? ['Desires'] : []),
      ...(!filled(draft.audience.objections) ? ['Objections'] : []),
    ];
  }
  if (section === 'offer') {
    return [
      ...(!filled(draft.offer.pricePresentation) ? ['Price presentation'] : []),
      ...(!filled(draft.offer.urgencyConstraints) ? ['Urgency constraints'] : []),
      ...(!/^https?:\/\//u.test(draft.offer.destinationUrl) ? ['Valid destination URL'] : []),
    ];
  }
  if (section === 'claimsLegal') {
    return [
      ...(!filled(draft.claimsLegal.approvedClaims) ? ['Approved claims'] : []),
      ...(!filled(draft.claimsLegal.evidenceSource) ? ['Evidence source for approved claims'] : []),
      ...(!filled(draft.claimsLegal.legalCopy) ? ['Legal copy'] : []),
      ...(draft.claimsLegal.prohibitedClaims.length === 0 ? ['At least one prohibited claim'] : []),
      ...(!filled(draft.claimsLegal.creativeConstraints) ? ['Creative constraints'] : []),
      ...(!draft.assets.rightsAttested ? ['Asset-rights attestation'] : []),
    ];
  }
  return [
    ...(draft.assets.packshots.length === 0 ? ['At least one product packshot'] : []),
    ...(!draft.assets.squarePackshotReady ? ['One square product packshot'] : []),
    ...(!draft.assets.rightsAttested ? ['Asset-rights attestation'] : []),
  ];
}

export function launchPackBriefFromDraft(draft: BriefDraft): {
  readonly briefId: string;
  readonly product: string;
  readonly category: string;
  readonly packshots: string;
  readonly features: string;
  readonly benefits: string;
  readonly evidence: string;
  readonly approvedFacts: string;
  readonly offer: string;
  readonly pricePresentation: string;
  readonly urgency: string;
  readonly destination: string;
  readonly brandKit: string;
  readonly audienceAndAwareness: string;
  readonly painsDesiresObjections: string;
  readonly requiredClaimsLegal: string;
  readonly prohibitedClaims: string;
  readonly creativeConstraintsRights: string;
  readonly stressVector: string;
} {
  return {
    briefId: `studio-${
      draft.productTruth.productName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .slice(0, 40) || 'campaign'
    }`,
    product: draft.productTruth.productName.trim(),
    category: draft.productTruth.category.trim(),
    packshots: packshotPromptMaterial(draft.assets.packshots),
    features: draft.productTruth.features.trim(),
    benefits: draft.productTruth.benefits.trim(),
    evidence: draft.productTruth.evidence.trim(),
    approvedFacts: draft.productTruth.approvedFacts.trim(),
    offer: draft.offer.pricePresentation.trim(),
    pricePresentation: draft.offer.pricePresentation.trim(),
    urgency: draft.offer.urgencyConstraints.trim(),
    destination: draft.offer.destinationUrl.trim(),
    brandKit: [
      draft.brandKit.colors,
      draft.brandKit.typography,
      draft.brandKit.tone,
      draft.brandKit.visualRules,
      draft.brandKit.examples,
      draft.brandKit.prohibitedTreatments,
    ]
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .join('; '),
    audienceAndAwareness: `${draft.audience.targetAudience.trim()}; ${draft.audience.awarenessStage.trim()}`,
    painsDesiresObjections: [
      draft.audience.painPoints,
      draft.audience.desires,
      draft.audience.objections,
    ]
      .map((part) => part.trim())
      .join('; '),
    requiredClaimsLegal: [draft.claimsLegal.approvedClaims, draft.claimsLegal.legalCopy]
      .map((part) => part.trim())
      .join(' '),
    prohibitedClaims: draft.claimsLegal.prohibitedClaims.join('; '),
    creativeConstraintsRights: [
      draft.claimsLegal.creativeConstraints,
      draft.assets.rightsAttested
        ? 'Rights attested for supplied packshots.'
        : 'Rights not attested.',
    ].join(' '),
    stressVector: draft.claimsLegal.creativeConstraints.trim(),
  };
}

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
