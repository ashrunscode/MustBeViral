import { z } from 'zod';

export const isResourceId = (value: string | undefined): value is string =>
  z.uuid().safeParse(value).success;
export function studioHref(studioId?: string, view?: 'team' | 'settings') {
  const query = new URLSearchParams();
  if (studioId) query.set('studio', studioId);
  if (view) query.set('view', view);
  return `/studio${query.size ? `?${query}` : ''}`;
}
export function brandHref(
  studioId: string,
  workspaceId: string,
  brandId: string,
  view?: string,
  locationId?: string,
) {
  const query = new URLSearchParams({ studio: studioId });
  if (view) query.set('view', view);
  if (locationId) query.set('location', locationId);
  return `/studio/${encodeURIComponent(workspaceId)}/brands/${encodeURIComponent(brandId)}?${query}`;
}
