'use client';
import { useSearchParams } from 'next/navigation';
import type { CampaignContext } from './platform-navigation';

/** The studio, brand, plan and run identifiers carried in a campaign link. */
export function readCampaignContext(params: URLSearchParams): CampaignContext {
  const pick = (key: string) => {
    const value = params.get(key);
    return value === null || value === '' ? undefined : value;
  };
  return {
    studio: pick('studio'),
    brand: pick('brand'),
    canvas: pick('canvas'),
    revision: pick('revision'),
    run: pick('run'),
  };
}

export function useCampaignContext(): CampaignContext {
  // Outside the app router (static render in tests) Next returns null here.
  const params = useSearchParams() as URLSearchParams | null;
  return readCampaignContext(params ?? new URLSearchParams());
}
