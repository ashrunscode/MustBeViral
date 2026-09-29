# Component inventory — ViralGraph cleanroom V2

Generation: `viralgraph-cleanroom-v2`. This analysis covers only the clean scaffold; no production UI exists yet by design (implementation is gated on the approved Precision Creative Studio artifact).

## Shared UI primitives

None implemented. The shared UI package (`packages/ui`) intentionally exports no components; its entire surface is the production-UI gate:

```ts
// packages/ui/src/index.ts
export const UI_IMPLEMENTATION_GATE = 'superdesign-approval-required' as const;

export function mayImplementProductionUi(approvedArtifactId?: string): boolean {
  return typeof approvedArtifactId === 'string' && approvedArtifactId.trim().length > 0;
}
```

## Application components

- `apps/web/app/layout.tsx` — `RootLayout` (html/body shell, imports `globals.css`, sets metadata).
- `apps/web/app/page.tsx` — `CleanroomPage` placeholder announcing the design gate.

No client components, no state management, no icons, no third-party UI libraries.

## Implication for design work

Every component in the approved design system will be net-new. There is no legacy visual language to reconcile; the accepted `docs/ux/EXPERIENCE_CONTRACT.md` is the sole source of visual truth.
