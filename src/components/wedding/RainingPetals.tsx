'use client';

import { useMemo, useState, useEffect } from 'react';
import type { AnimationDensity } from '@/lib/animation-registry';

const styles = `
  /*
   * Raining Petals — repurposed as a top-down raindrop ripple effect.
   *
   * Concentric rings emerge from random points across the screen and
   * expand outward while fading — like raindrops landing on still water
   * viewed from above. Subtle and elegant.
   *
   * Each ripple is a single div with a border that scales from 0 to full
   * size while its opacity decays. Multiple ripples at different positions
   * and delays create the "rain on water" texture.
   *
   * NOTE: The internal class name .rp-petal is retained for backward
   * compatibility with existing WeddingFeature.config values — couples
   * who selected "raining" before this redesign will automatically see
   * the new ripple effect without any data migration.
   */

  .rp-petal {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.7);
    /* Soft dark halo gives the white rings definition against light backgrounds. */
    box-shadow:
      0 0 3px 1px rgba(60, 50, 40, 0.22),
      0 0 1px 0.5px rgba(60, 50, 40, 0.25);
    opacity: 0;
    animation: rpRipple var(--rp-dur, 4.5s) ease-out var(--rp-delay, 0s) infinite;
    will-change: transform, opacity;
  }

  /*
   * rpRipple — a single raindrop ripple expanding outward and fading.
   * The ring starts as a tiny point, grows to its full size, and
   * gradually becomes transparent. ease-out gives the natural
   * deceleration of a real water ripple.
   *
   * The translate(-50%, -50%) centers each ripple on its (left, top)
   * point; the scale() handles the expansion. Both must be in every
   * keyframe so the centering is preserved throughout the animation.
   */
  @keyframes rpRipple {
    0% {
      transform: translate(-50%, -50%) scale(0);
      opacity: 0;
      border-width: 2px;
    }
    12% {
      opacity: var(--rp-op, 0.75);
    }
    55% {
      opacity: var(--rp-op, 0.75);
      border-width: 1.5px;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0;
      border-width: 1px;
    }
  }

  /* Accessibility: guests who prefer reduced motion see no animation. */
  @media (prefers-reduced-motion: reduce) {
    .rp-petal { display: none !important; }
  }
`;

const DENSITY_COUNT: Record<AnimationDensity, number> = {
  low: 8,
  medium: 14,
  high: 22,
};

const MOBILE_PARTICLE_CAP = 12;

interface RainingPetalsProps {
  /** Particle density. Defaults to 'medium'. */
  density?: AnimationDensity;
}

/**
 * Raining Petals — a top-down raindrop ripple effect.
 *
 * Concentric rings emerge from random points across the screen and expand
 * outward while fading, like raindrops landing on still water viewed from
 * above. Subtle and elegant.
 *
 * Design notes:
 *   - Each ripple is a single bordered div that scales from 0 to its full
 *     size while opacity decays from ~0.5 to 0.
 *   - Soft white/cyan tint with a gentle box-shadow glow.
 *   - Rings appear at staggered intervals and random positions for the
 *     "rain on water" texture.
 *   - Subtle by design — the effect is ambient, not attention-grabbing.
 *
 * Performance safeguards:
 *   - Pure CSS animation (GPU-composited scale + opacity, no rAF loop).
 *   - Mobile particle cap (≤ 8 on screens < 768px).
 *   - prefers-reduced-motion: ripples hidden entirely.
 *   - will-change limited to transform + opacity (compositor-only).
 *   - Each ripple is one div (no nested DOM, no canvas).
 *
 * NOTE: The component name "RainingPetals" and the CSS class ".rp-petal"
 * are retained for backward compatibility — the WeddingFeature.config value
 * "raining" maps to this component via AnimationRenderer. The visual style
 * was changed from falling petals to raindrop ripples per user feedback,
 * but no data migration was needed.
 */
export default function RainingPetals({ density = 'medium' }: RainingPetalsProps) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const baseCount = DENSITY_COUNT[density] ?? DENSITY_COUNT.medium;
  const count = isMobile ? Math.min(baseCount, MOBILE_PARTICLE_CAP) : baseCount;

  const ripples = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        // Deterministic pseudo-random distribution (stable across SSR/hydration)
        const left = (i * 37.3 + 7) % 100;
        const top = (i * 53.1 + 13) % 100;
        // Wide range of sizes — many small ripples (40px) + fewer large ones (up to 280px).
        // The small ripples create a dense, lively texture; the large ones add depth.
        const sizeCycle = i % 7;
        const size = sizeCycle < 4
          ? 40 + sizeCycle * 25            // 40, 65, 90, 115px (small — most common)
          : 140 + (sizeCycle - 4) * 45;    // 140, 185, 230, 275px (medium-large)
        // Ripple duration: 3.5s to 6s (one expand-and-fade cycle)
        const duration = 3.5 + (i % 5) * 0.6;
        // Stagger delays so ripples don't all pulse in sync
        const delay = (i * 0.7) % 4;
        // Peak opacity: 0.6 to 0.8 (visible but not harsh)
        const opacity = 0.6 + (i % 3) * 0.1;
        return {
          left: `${left}%`,
          top: `${top}%`,
          size,
          duration,
          delay,
          opacity,
        };
      }),
    [count],
  );

  return (
    <div
      className="fixed left-0 right-0 bottom-0 pointer-events-none overflow-hidden"
      style={{ top: 'var(--fs-offset-top, 51px)', zIndex: 45 }}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {ripples.map((r, i) => (
        <div
          key={i}
          className="rp-petal"
          style={{
            left: r.left,
            top: r.top,
            width: `${r.size}px`,
            height: `${r.size}px`,
            // transform is set entirely by the rpRipple keyframe
            // (translate(-50%, -50%) + scale) so the ripple stays
            // centered on its (left, top) point as it expands.
            '--rp-dur': `${r.duration}s`,
            '--rp-delay': `${r.delay}s`,
            '--rp-op': r.opacity,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
