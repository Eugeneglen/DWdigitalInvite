/**
 * Animation Registry — client-safe single source of truth.
 *
 * This file contains NO database imports and is safe to import from both
 * client components and server code. Server-only availability-reading
 * functions live in src/lib/animation-entitlements.ts.
 *
 * ── Redesigned data model ──────────────────────────────────────────────
 *
 * Admin controls AVAILABILITY (which animations exist in the system).
 *   Stored in SystemSetting 'animation_styles_available' as JSON:
 *   { "gold-dust": true, "flying-stars": true, "raining": false }
 *   When an animation is false, it's hidden from all couples entirely.
 *
 * Couple controls ACTIVATION (which available animations to show on their site).
 *   Stored in WeddingFeature { featureKey: 'animation' } config JSON:
 *   { "styles": { "gold-dust": true, "flying-stars": false, "raining": true } }
 *   The row's isEnabled flag is the master "any animation at all" flag.
 *
 * Guest site renders ALL activated styles simultaneously (e.g. gold dust
 * AND bubbles can both appear on the same invitation).
 *
 * Adding a new animation style:
 *   1. Add a new AnimationStyleDefinition entry to ANIMATION_STYLES below.
 *   2. Build the corresponding component in src/components/wedding/.
 *   3. Wire it into AnimationRenderer.tsx.
 *   4. The Admin CMS availability UI will auto-pick it up from this registry.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface AnimationStyleDefinition {
  /** Unique key stored in config JSON and availability JSON. */
  key: string;
  /** Human-readable label shown in the Couple CMS and Admin CMS. */
  label: string;
  /** Short description of the effect. */
  description: string;
}

/**
 * Per-style availability map controlled by the Admin CMS.
 * Keys are style keys; values are booleans (true = available to couples).
 * Stored in SystemSetting 'animation_styles_available'.
 */
export type AnimationAvailability = Record<string, boolean>;

/**
 * Per-style activation map controlled by the Couple CMS.
 * Keys are style keys; values are booleans (true = render on guest site).
 * Stored in WeddingFeature { featureKey: 'animation' } config JSON.
 *
 * Only styles that are available (per AnimationAvailability) can be
 * activated by the couple. The backend enforces this on PUT.
 */
export interface AnimationActivation {
  styles: Record<string, boolean>;
}

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * SystemSetting key that stores the admin-controlled per-style availability
 * map as JSON: { "gold-dust": true, "flying-stars": true, "raining": false }
 */
export const ANIMATION_AVAILABILITY_KEY = 'animation_styles_available';

/**
 * Legacy SystemSetting key (tier→styles map). Retained for backward
 * compatibility — if the new key is absent but the legacy key exists,
 * the server helpers fall back to deriving availability from it.
 */
export const ANIMATION_ENTITLEMENTS_KEY = 'animation_styles_per_tier';

/** The featureKey used in the WeddingFeature table for animation. */
export const ANIMATION_FEATURE_KEY = 'animation';

/** All recognised tier plan names (retained for legacy fallback only). */
export const TIER_KEYS = ['GOLD', 'PLATINUM', 'DIAMOND'] as const;
export type TierKey = (typeof TIER_KEYS)[number];

export const TIER_LABELS: Record<TierKey, string> = {
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
  DIAMOND: 'Diamond',
};

/**
 * The canonical list of animation styles.
 *
 * Each new entry here automatically appears in the Admin CMS availability
 * editor and the Couple CMS activation picker.
 */
export const ANIMATION_STYLES: AnimationStyleDefinition[] = [
  {
    key: 'gold-dust',
    label: 'Gold Dust',
    description:
      'Ambient gold particles drifting upward — the signature Dreamweavers effect. Subtle and elegant.',
  },
  {
    key: 'flying-stars',
    label: 'Meteors',
    description:
      'Shooting-star meteors falling through a twinkling night sky — thin white streaks with glowing tails against a starfield. Dramatic and dreamy.',
  },
  {
    key: 'raining',
    label: 'Bubbles',
    description:
      'Top-down raindrop ripples — soft concentric rings expanding and fading across the screen like rain on still water. Subtle and serene.',
  },
];

/** Quick lookup map by key. */
export const ANIMATION_STYLE_MAP: Record<string, AnimationStyleDefinition> = Object.fromEntries(
  ANIMATION_STYLES.map((s) => [s.key, s]),
);

/** All valid style keys (derived from the registry). */
export const ANIMATION_STYLE_KEYS = ANIMATION_STYLES.map((s) => s.key);

// ── Default Availability ────────────────────────────────────────────────────
//
// Used when the Admin CMS hasn't configured animation_styles_available yet,
// and as the fallback for any style missing from the stored JSON.
// By default all styles are available — the admin can turn any off.

export const DEFAULT_ANIMATION_AVAILABILITY: AnimationAvailability = Object.fromEntries(
  ANIMATION_STYLES.map((s) => [s.key, true]),
);

// Legacy default entitlements (used only for backward-compat fallback).
// When the old animation_styles_per_tier key exists but the new
// animation_styles_available key doesn't, we derive availability by
// unioning all tiers' allowedStyles.

export const DEFAULT_ANIMATION_ENTITLEMENTS = {
  GOLD: { allowedStyles: ['gold-dust'], defaultStyle: 'gold-dust' },
  PLATINUM: { allowedStyles: ['gold-dust', 'flying-stars'], defaultStyle: 'gold-dust' },
  DIAMOND: { allowedStyles: ['gold-dust', 'flying-stars', 'raining'], defaultStyle: 'gold-dust' },
};

// ── Pure Helpers (client-safe) ──────────────────────────────────────────────

/** Get a style definition by key. Returns undefined for unknown keys. */
export function getStyleDefinition(key: string): AnimationStyleDefinition | undefined {
  return ANIMATION_STYLE_MAP[key];
}

/**
 * Normalise an availability object from an arbitrary JSON source
 * (e.g. SystemSetting value). Falls back to DEFAULT_ANIMATION_AVAILABILITY
 * for any missing or malformed entries. Unknown style keys are preserved
 * (so new styles added to the registry don't get lost if the stored JSON
 * predates them — they default to available).
 */
export function normaliseAvailability(raw: unknown): AnimationAvailability {
  const result: AnimationAvailability = {};
  for (const style of ANIMATION_STYLES) {
    const val = (raw as Record<string, unknown>)?.[style.key];
    result[style.key] = typeof val === 'boolean' ? val : DEFAULT_ANIMATION_AVAILABILITY[style.key];
  }
  return result;
}

/**
 * Normalise an activation object from an arbitrary JSON source
 * (e.g. WeddingFeature.config parsed object). Falls back to all-false
 * for any missing or malformed entries.
 *
 * NOTE: this does NOT filter by availability — the caller must intersect
 * with the availability map before rendering or saving.
 */
export function normaliseActivation(raw: unknown): AnimationActivation {
  const fallback: AnimationActivation = { styles: {} };
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const stylesRaw = obj.styles;
  if (!stylesRaw || typeof stylesRaw !== 'object') {
    // Legacy single-style config migration: {style:"gold-dust", density:"medium"}
    // → {styles:{"gold-dust": true}}
    if (typeof obj.style === 'string' && obj.style && obj.style !== 'none') {
      return { styles: { [obj.style]: true } };
    }
    return fallback;
  }
  const stylesObj = stylesRaw as Record<string, unknown>;
  const styles: Record<string, boolean> = {};
  for (const style of ANIMATION_STYLES) {
    const val = stylesObj[style.key];
    styles[style.key] = typeof val === 'boolean' ? val : false;
  }
  return { styles };
}

/**
 * Parse a WeddingFeature.config JSON string into an AnimationActivation.
 * Falls back to all-false when the string is missing or malformed,
 * so a corrupt DB row never breaks the guest page.
 */
export function parseAnimationActivation(config: string | null | undefined): AnimationActivation {
  if (!config) return { styles: {} };
  try {
    return normaliseActivation(JSON.parse(config));
  } catch {
    return { styles: {} };
  }
}

/**
 * Determine which styles should actually render on the guest site:
 * the intersection of available (admin) and activated (couple).
 */
export function getActiveStyles(
  availability: AnimationAvailability | null | undefined,
  activation: AnimationActivation | null | undefined,
): string[] {
  const avail = availability ?? {};
  const activ = activation?.styles ?? {};
  return ANIMATION_STYLE_KEYS.filter(
    (key) => avail[key] !== false && activ[key] === true,
  );
}
