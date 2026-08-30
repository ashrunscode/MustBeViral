import { describe, expect, it } from 'vitest';

import {
  BriefDraftSchema,
  BriefDraftStorageError,
  InMemoryBriefDraftPort,
  SessionStorageBriefDraftPort,
  STAGING_SYNTHETIC_PACKSHOTS,
  briefSectionState,
  firstIncompleteBriefSection,
  launchPackBriefFromDraft,
  lumenSkinDraft,
  missingBriefItems,
  stagingWorkerDraft,
} from './brief-schema';

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
    await port.clear('lumen-skin');
    await expect(port.load('lumen-skin')).resolves.toBeNull();
  });

  it('restores only schema-valid session drafts scoped to subject and workspace', async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    const alice = new SessionStorageBriefDraftPort('user-alice', () => storage);
    const bob = new SessionStorageBriefDraftPort('user-bob', () => storage);
    const draft = stagingWorkerDraft();
    draft.productTruth.productName = 'Session campaign';

    await alice.save('workspace-a', draft);
    draft.productTruth.productName = 'Mutated after save';
    await expect(alice.load('workspace-a')).resolves.toMatchObject({
      productTruth: { productName: 'Session campaign' },
    });
    await expect(alice.load('workspace-b')).resolves.toBeNull();
    await expect(bob.load('workspace-a')).resolves.toBeNull();

    await alice.clear('workspace-a');
    await expect(alice.load('workspace-a')).resolves.toBeNull();
  });

  it('discards corrupt session draft envelopes without echoing or blocking editing', async () => {
    const values = new Map<string, string>([
      ['mustbeviral:brief-draft:v1:user-alice:workspace-a', '{"raw_secret":"do-not-echo"}'],
    ]);
    const port = new SessionStorageBriefDraftPort('user-alice', () => ({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }));

    await expect(port.load('workspace-a')).resolves.toBeNull();
    expect(values.size).toBe(0);
  });

  it('keeps editing available when sessionStorage cannot be read', async () => {
    const port = new SessionStorageBriefDraftPort('user-alice', () => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    await expect(port.load('workspace-a')).resolves.toBeNull();
    await expect(port.save('workspace-a', stagingWorkerDraft())).rejects.toEqual(
      new BriefDraftStorageError('The draft could not be saved in this browser session.'),
    );
  });

  it('selects the first incomplete worker section in workflow order', () => {
    expect(firstIncompleteBriefSection(stagingWorkerDraft())).toBe('productTruth');
    expect(firstIncompleteBriefSection(lumenSkinDraft)).toBe('claimsLegal');
    expect(
      firstIncompleteBriefSection({
        ...lumenSkinDraft,
        claimsLegal: {
          ...lumenSkinDraft.claimsLegal,
          evidenceSource: 'Formulation dossier, page 12',
        },
        assets: { ...lumenSkinDraft.assets, squarePackshotReady: true, rightsAttested: true },
      }),
    ).toBeNull();
  });

  it('does not mark product or offer sections complete when required fields are empty', () => {
    const emptyOffer = {
      ...lumenSkinDraft,
      productTruth: { ...lumenSkinDraft.productTruth, productName: '' },
      offer: { ...lumenSkinDraft.offer, pricePresentation: '' },
    };
    expect(briefSectionState('productTruth', emptyOffer).complete).toBe(false);
    expect(briefSectionState('offer', emptyOffer).complete).toBe(false);
    expect(missingBriefItems(emptyOffer)).toEqual(
      expect.arrayContaining(['Product name', 'Price presentation']),
    );
  });

  it('gives the worker draft synthetic staging packshots so Validate is reachable', () => {
    const draft = stagingWorkerDraft();
    expect(draft.assets.packshots).toEqual([...STAGING_SYNTHETIC_PACKSHOTS]);
    expect(missingBriefItems(draft)).not.toContain('At least one product packshot');
    expect(missingBriefItems(draft)).toEqual(
      expect.arrayContaining(['At least one prohibited claim', 'Creative constraints']),
    );
  });

  it('maps a complete draft onto the launch-pack brief the graph builder consumes', () => {
    const completeDraft = {
      ...lumenSkinDraft,
      claimsLegal: {
        ...lumenSkinDraft.claimsLegal,
        evidenceSource: 'Formulation dossier, page 12',
      },
      assets: { ...lumenSkinDraft.assets, squarePackshotReady: true, rightsAttested: true },
    };
    const mapped = launchPackBriefFromDraft(completeDraft);
    expect(mapped.product).toBe('Lumen Skin Barrier Serum');
    expect(mapped.prohibitedClaims).toContain('Cures acne');
    expect(mapped.packshots).toContain('front-packshot.png');
    expect(mapped.destination).toBe('https://example.com/products/barrier-serum');
  });

  it('does not send synthetic staging filenames into the image-prompt packshot field', () => {
    const mapped = launchPackBriefFromDraft({
      ...lumenSkinDraft,
      assets: {
        packshots: [...STAGING_SYNTHETIC_PACKSHOTS],
        squarePackshotReady: true,
        rightsAttested: true,
      },
    });
    expect(mapped.packshots).toBe(
      'Square and front product packshots on a clean surface; product-only; no lifestyle talent; label and packaging readable.',
    );
    expect(mapped.packshots).not.toMatch(/staging-.*\.png/u);
  });

  it('does not send uploaded artifact identifiers into the image-prompt packshot field', () => {
    const mapped = launchPackBriefFromDraft({
      ...lumenSkinDraft,
      assets: {
        packshots: ['uploaded:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
        squarePackshotReady: true,
        rightsAttested: true,
      },
    });
    expect(mapped.packshots).toBe(
      'Buyer-uploaded product packshot; product-only; label and packaging readable; no lifestyle talent.',
    );
    expect(mapped.packshots).not.toContain('uploaded:');
  });
});
