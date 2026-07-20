import { describe, expect, it } from 'vitest';

import { BriefDraftSchema, InMemoryBriefDraftPort, lumenSkinDraft } from './brief-schema';

describe('campaign brief validation', () => {
  it('blocks the golden draft on evidence, rights, and square-packshot gates', () => {
    const result = BriefDraftSchema.safeParse(lumenSkinDraft);
    expect(result.success).toBe(false);
    if (result.success) return;
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining([
        'claimsLegal.evidenceSource',
        'assets.squarePackshotReady',
        'assets.rightsAttested',
      ]),
    );
  });

  it('accepts a complete contract-shaped brief', () => {
    const completeDraft = {
      ...lumenSkinDraft,
      claimsLegal: {
        ...lumenSkinDraft.claimsLegal,
        evidenceSource: 'Formulation dossier, page 12',
      },
      assets: { ...lumenSkinDraft.assets, squarePackshotReady: true, rightsAttested: true },
    };
    expect(BriefDraftSchema.safeParse(completeDraft).success).toBe(true);
  });

  it('requires a valid destination URL and prohibited-claim boundary', () => {
    const result = BriefDraftSchema.safeParse({
      ...lumenSkinDraft,
      offer: { ...lumenSkinDraft.offer, destinationUrl: 'not-a-url' },
      claimsLegal: { ...lumenSkinDraft.claimsLegal, prohibitedClaims: [] },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['offer.destinationUrl', 'claimsLegal.prohibitedClaims']),
    );
  });

  it('saves isolated snapshots through the in-memory draft port', async () => {
    const port = new InMemoryBriefDraftPort();
    const draft = { ...lumenSkinDraft, productTruth: { ...lumenSkinDraft.productTruth } };
    await port.save('lumen-skin', draft);
    draft.productTruth.productName = 'Changed after save';
    expect((await port.load('lumen-skin'))?.productTruth.productName).toBe(
      'Lumen Skin Barrier Serum',
    );
  });
});
