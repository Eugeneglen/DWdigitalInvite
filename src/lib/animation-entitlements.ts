/**
 * Animation Availability — server-only helpers.
 *
 * These functions read the animation_styles_available SystemSetting from
 * the database and must ONLY be imported by server code (API routes, server
 * components, scripts). Client components receive availability data via API
 * responses instead.
 *
 * ── Redesigned data model ──────────────────────────────────────────────
 *
 * Admin controls AVAILABILITY via SystemSetting 'animation_styles_available'
 * (a {styleKey: boolean} JSON map). This replaces the old tier-based
 * 'animation_styles_per_tier' entitlement system.
 *
 * For backward compatibility, if the new key is absent but the legacy key
 * exists, availability is derived by unioning all tiers' allowedStyles.
 */

import { db } from '@/lib/db';
import {
  ANIMATION_AVAILABILITY_KEY,
  ANIMATION_ENTITLEMENTS_KEY,
  ANIMATION_STYLES,
  DEFAULT_ANIMATION_AVAILABILITY,
  DEFAULT_ANIMATION_ENTITLEMENTS,
  normaliseAvailability,
  type AnimationAvailability,
  type AnimationActivation,
} from '@/lib/animation-registry';

/**
 * Read the admin-controlled per-style availability map from the database.
 *
 * Falls back to DEFAULT_ANIMATION_AVAILABILITY (all styles available) when
 * no setting exists. For backward compatibility, if the legacy
 * 'animation_styles_per_tier' key exists but the new key doesn't, derives
 * availability by unioning all tiers' allowedStyles.
 */
export async function getAnimationAvailability(): Promise<AnimationAvailability> {
  const settings = await db.systemSetting.findMany({
    where: { key: { in: [ANIMATION_AVAILABILITY_KEY, ANIMATION_ENTITLEMENTS_KEY] } },
  });

  const newSetting = settings.find((s) => s.key === ANIMATION_AVAILABILITY_KEY);
  if (newSetting) {
    try {
      return normaliseAvailability(JSON.parse(newSetting.value));
    } catch {
      return DEFAULT_ANIMATION_AVAILABILITY;
    }
  }

  // Legacy fallback: derive availability from the old tier-based entitlements.
  const legacySetting = settings.find((s) => s.key === ANIMATION_ENTITLEMENTS_KEY);
  if (legacySetting) {
    try {
      const legacy = JSON.parse(legacySetting.value) as Record<string, { allowedStyles?: string[] }>;
      const unionStyles = new Set<string>();
      for (const tier of Object.values(legacy)) {
        if (Array.isArray(tier?.allowedStyles)) {
          for (const s of tier.allowedStyles) unionStyles.add(s);
        }
      }
      const derived: AnimationAvailability = {};
      for (const style of ANIMATION_STYLES) {
        derived[style.key] = unionStyles.has(style.key);
      }
      return derived;
    } catch {
      // fall through to default
    }
  }

  return DEFAULT_ANIMATION_AVAILABILITY;
}

/**
 * Get the list of style keys the admin has made available.
 * Convenience wrapper around getAnimationAvailability().
 */
export async function getAvailableAnimationStyles(): Promise<string[]> {
  const availability = await getAnimationAvailability();
  return ANIMATION_STYLES.map((s) => s.key).filter((key) => availability[key] !== false);
}

/**
 * Build the default AnimationActivation config JSON string for a new wedding.
 *
 * With the redesigned model, the couple's activation defaults to the first
 * available style turned ON (so new weddings have a sensible default
 * animation), and all other styles OFF. If no styles are available, all
 * are OFF.
 *
 * Returns a JSON string: {"styles":{"gold-dust":true,"flying-stars":false,...}}
 */
export async function getDefaultAnimationConfig(): Promise<string> {
  const available = await getAvailableAnimationStyles();
  const styles: Record<string, boolean> = {};
  for (const style of ANIMATION_STYLES) {
    // Default: first available style is ON, rest OFF.
    styles[style.key] = available[0] === style.key;
  }
  const activation: AnimationActivation = { styles };
  return JSON.stringify(activation);
}

/**
 * Reconcile a couple's activation config against the current availability.
 *
 * Called when the admin changes availability (turns a style OFF) to ensure
 * the couple's activation doesn't reference a style that's no longer available.
 * Removes any activated styles that are no longer available.
 *
 * Returns the reconciled JSON string, or null if no change was needed.
 */
export async function reconcileActivationWithAvailability(
  currentConfigJson: string | null | undefined,
): Promise<string | null> {
  const available = await getAnimationAvailability();
  if (!currentConfigJson) {
    // No existing config — return a fresh default
    return getDefaultAnimationConfig();
  }

  try {
    const parsed = JSON.parse(currentConfigJson) as { styles?: Record<string, boolean> };
    const styles = parsed.styles ?? {};
    let changed = false;
    const reconciled: Record<string, boolean> = {};

    for (const style of ANIMATION_STYLES) {
      const wasActive = styles[style.key] === true;
      const isAvailable = available[style.key] !== false;
      // If a style is active but no longer available, turn it off.
      if (wasActive && !isAvailable) {
        reconciled[style.key] = false;
        changed = true;
      } else {
        reconciled[style.key] = wasActive;
      }
    }

    if (!changed) return null; // no change needed
    return JSON.stringify({ styles: reconciled });
  } catch {
    // Malformed config — return a fresh default
    return getDefaultAnimationConfig();
  }
}

// ── Legacy compatibility (retained for existing code that may still call these) ─

/**
 * @deprecated Use getAnimationAvailability() instead.
 * Returns a legacy-shaped entitlement object derived from the current
 * availability map (all available styles go to all tiers).
 */
export async function getAnimationEntitlements() {
  const available = await getAnimationAvailability();
  const allowedStyles = ANIMATION_STYLES.filter((s) => available[s.key] !== false).map((s) => s.key);
  const defaultStyle = allowedStyles[0] ?? 'gold-dust';
  const result: Record<string, { allowedStyles: string[]; defaultStyle: string }> = {};
  for (const tier of ['GOLD', 'PLATINUM', 'DIAMOND'] as const) {
    result[tier] = { allowedStyles: [...allowedStyles], defaultStyle };
  }
  return result;
}

/**
 * @deprecated Use getAvailableAnimationStyles() instead.
 */
export async function getEntitlementsForTier(_plan: string) {
  const ent = await getAnimationEntitlements();
  return ent['GOLD'] ?? DEFAULT_ANIMATION_ENTITLEMENTS['GOLD'];
}

/**
 * @deprecated Use getDefaultAnimationConfig() instead.
 */
export async function getDefaultAnimationConfigForTier(_plan: string): Promise<string> {
  return getDefaultAnimationConfig();
}
