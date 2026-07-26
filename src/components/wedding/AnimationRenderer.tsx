'use client';

import GoldDust from './GoldDust';
import FlyingStars from './FlyingStars';
import RainingPetals from './RainingPetals';

interface AnimationRendererProps {
  /** Feature flags map from the public wedding API. Each animation style is its own featureKey: 'animation:gold-dust', 'animation:flying-stars', 'animation:raining'. */
  featureFlags: Record<string, boolean> | null | undefined;
}

/**
 * Config-driven animation dispatcher.
 *
 * Each animation style is its own WeddingFeature row with featureKey
 * 'animation:gold-dust', 'animation:flying-stars', 'animation:raining'.
 * The admin controls availability (whether the row exists and isEnabled
 * at creation time), the couple controls activation (toggling isEnabled
 * via their CMS), and this renderer shows all enabled styles.
 *
 * Adding a new style:
 *   1. Add the style to ANIMATION_STYLES in src/lib/animation-registry.ts.
 *   2. Build the component in src/components/wedding/.
 *   3. Add a case below.
 */
function renderAnimationStyle(styleKey: string) {
  switch (styleKey) {
    case 'animation:gold-dust':
      return <GoldDust />;
    case 'animation:flying-stars':
      return <FlyingStars />;
    case 'animation:raining':
      return <RainingPetals />;
    default:
      // Unknown style — render nothing rather than crashing the guest page.
      return null;
  }
}

const ANIMATION_FEATURE_KEYS = ['animation:gold-dust', 'animation:flying-stars', 'animation:raining'];

export default function AnimationRenderer({ featureFlags }: AnimationRendererProps) {
  if (!featureFlags) return null;

  const activeStyles = ANIMATION_FEATURE_KEYS.filter((key) => featureFlags[key] === true);
  if (activeStyles.length === 0) return null;

  return (
    <>
      {activeStyles.map((styleKey) => (
        <div key={styleKey} aria-hidden="true">
          {renderAnimationStyle(styleKey)}
        </div>
      ))}
    </>
  );
}
