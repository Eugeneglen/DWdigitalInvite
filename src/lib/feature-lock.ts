import type { CoupleCMSPage } from '@/store/useCoupleCMSStore';

/**
 * Map Couple CMS pages to their corresponding WeddingFeature featureKey.
 * Pages NOT in this map are always available (overview, details, guests, etc.)
 */
export const PAGE_TO_FEATURE: Partial<Record<CoupleCMSPage, string>> = {
  schedule: 'schedule',
  rsvps: 'rsvp',
  'getting-there': 'getting-there',
  story: 'story',
  wishes: 'wishes',
  faqs: 'qa',
  moments: 'moments',
  design: 'templates',
};

/**
 * Pages that are always available regardless of feature flags.
 */
export const ALWAYS_AVAILABLE_PAGES: CoupleCMSPage[] = [
  'overview',
  'details',
  'home',
  'guests',
  'analytics',
  'audit',
  'sharing',
  'features',
];

/**
 * Given a CoupleCMSPage and the wedding's feature flags, return whether
 * the page is accessible to the couple.
 */
export function isPageEnabled(
  page: CoupleCMSPage,
  featureFlags: Record<string, boolean>,
): boolean {
  if (ALWAYS_AVAILABLE_PAGES.includes(page)) return true;
  const featureKey = PAGE_TO_FEATURE[page];
  if (!featureKey) return true; // unknown page → default to enabled
  if (!(featureKey in featureFlags)) return true; // flag not set → default to enabled
  return featureFlags[featureKey] === true;
}

/**
 * Extract feature flags from the wedding data object returned by /api/cms/wedding.
 */
export function extractFeatureFlags(weddingData: Record<string, unknown> | null): Record<string, boolean> {
  if (!weddingData) return {};
  const features = (weddingData as { features?: Array<{ featureKey: string; isEnabled: boolean }> }).features;
  if (!Array.isArray(features)) return {};
  const map: Record<string, boolean> = {};
  for (const f of features) {
    map[f.featureKey] = f.isEnabled;
  }
  return map;
}
