export const CANONICAL_ARTIFACT_VISIBILITY = 'private' as const;

export type ArtifactVisibility = typeof CANONICAL_ARTIFACT_VISIBILITY;

export function requirePrivateArtifact(value: string): ArtifactVisibility {
  if (value !== CANONICAL_ARTIFACT_VISIBILITY) {
    throw new Error('Canonical media must remain private');
  }
  return value;
}
