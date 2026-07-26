'use client';

import { useMemo, useState, useEffect } from 'react';
import type { AnimationDensity } from '@/lib/animation-registry';

const styles = `
  /*
   * Meteor field — falling shooting stars against a static starfield.
   *
   * Two layers:
   *   1. .fs-bgstar — tiny static twinkling background stars (depth).
   *   2. .fs-meteor — elongated vertical streaks with a bright head and a
   *      tapering tail, falling straight down at varying speeds.
   *
   * Meteors use a linear-gradient background to render the trail
   * (transparent → bright white at the head) plus a soft glow via
   * box-shadow. The fsFall animation moves them top-to-bottom through
   * the viewport with a short fade-in/fade-out at the edges.
   */

  .fs-meteor {
    position: absolute;
    width: 1.5px;
    /* height is set per-meteor via --fs-len */
    height: var(--fs-len, 120px);
    background: linear-gradient(
      to top,
      rgba(255, 255, 255, 0.9) 0%,
      rgba(255, 250, 240, 0.7) 10%,
      rgba(220, 230, 255, 0.35) 45%,
      rgba(180, 200, 255, 0.1) 75%,
      rgba(180, 200, 255, 0) 100%
    );
    border-radius: 50% 50% 0 0;
    /* Subtle glow halo around the bright head */
    box-shadow:
      0 0 4px 0.5px rgba(255, 255, 255, 0.4),
      0 0 8px 1px rgba(200, 220, 255, 0.2);
    opacity: 0;
    animation: fsFall var(--fs-dur, 3.5s) linear var(--fs-delay, 0s) infinite;
    will-change: transform, opacity;
  }

  /*
   * fsFall — meteors originate from the very top of the viewport (behind
   * the fixed header) and fall straight down. The fade-in over the first
   * ~6% makes them appear to emerge from just below the header rather
   * than popping in from off-screen above.
   */
  @keyframes fsFall {
    0% {
      opacity: 0;
      transform: translateY(0);
    }
    6% { opacity: var(--fs-op, 0.7); }
    90% { opacity: var(--fs-op, 0.7); }
    100% {
      opacity: 0;
      transform: translateY(115vh);
    }
  }

  .fs-bgstar {
    position: absolute;
    width: var(--fs-bs-size, 2px);
    height: var(--fs-bs-size, 2px);
    background: rgba(220, 230, 255, var(--fs-bs-op, 0.5));
    border-radius: 50%;
    animation: fsTwinkle var(--fs-bs-dur, 4s) ease-in-out var(--fs-bs-delay, 0s) infinite;
  }

  @keyframes fsTwinkle {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 0.85; }
  }

  /* Accessibility: guests who prefer reduced motion see no animation. */
  @media (prefers-reduced-motion: reduce) {
    .fs-meteor, .fs-bgstar { display: none !important; }
  }
`;

const DENSITY_COUNT: Record<AnimationDensity, number> = {
  low: 5,
  medium: 9,
  high: 14,
};

const MOBILE_PARTICLE_CAP = 7;

// Background star count is higher than meteor count — they're cheap (no
// gradient, no box-shadow) and give the field depth. Kept subtle.
const BG_STAR_COUNT: Record<AnimationDensity, number> = {
  low: 30,
  medium: 50,
  high: 80,
};

const BG_STAR_MOBILE_CAP = 35;

interface FlyingStarsProps {
  /** Particle density. Defaults to 'medium'. */
  density?: AnimationDensity;
}

/**
 * Flying Stars — a shooting-star / meteor field effect.
 *
 * Two layers:
 *   1. A static starfield of tiny twinkling background stars for depth.
 *   2. Falling meteors — thin, elongated vertical streaks with a bright
 *      white head, a tapering blue-white tail, and a soft glow halo.
 *      Each meteor falls straight down at a randomized speed, fades in
 *      at the top of the viewport, and fades out at the bottom.
 *
 * Performance safeguards:
 *   - Pure CSS animation (GPU-composited, no rAF loop).
 *   - Mobile particle cap for both meteors and background stars.
 *   - prefers-reduced-motion: everything hidden.
 *   - will-change limited to transform + opacity (compositor-only).
 *   - Meteors use a single gradient div each (no trail of DOM nodes).
 */
export default function FlyingStars({ density = 'medium' }: FlyingStarsProps) {
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
  const meteorCount = isMobile ? Math.min(baseCount, MOBILE_PARTICLE_CAP) : baseCount;

  const bgBase = BG_STAR_COUNT[density] ?? BG_STAR_COUNT.medium;
  const bgStarCount = isMobile ? Math.min(bgBase, BG_STAR_MOBILE_CAP) : bgBase;

  const meteors = useMemo(
    () =>
      Array.from({ length: meteorCount }).map((_, i) => {
        // Deterministic pseudo-random distribution (stable across SSR/hydration)
        const left = (i * 73.3 + 5) % 100;
        // Meteor trail length: 60px to 160px (subtle, not too long)
        const len = 60 + (i % 5) * 25;
        // Fall duration: 3.5s to 6.5s (gentle, not too fast)
        const duration = 3.5 + (i % 6) * 0.5;
        // Stagger delays so meteors don't all fall at once
        const delay = (i * 1.7) % 9;
        // Opacity: 0.4 to 0.75 (subtle, not attention-grabbing)
        const opacity = 0.4 + (i % 4) * 0.1;
        return {
          left: `${left}%`,
          len,
          duration,
          delay,
          opacity,
        };
      }),
    [meteorCount],
  );

  const bgStars = useMemo(
    () =>
      Array.from({ length: bgStarCount }).map((_, i) => {
        // Deterministic distribution across the full viewport
        const left = (i * 41.7 + 3) % 100;
        const top = (i * 29.3 + 7) % 100;
        const size = 1 + (i % 3) * 0.5; // 1px to 2px
        const opacity = 0.3 + (i % 4) * 0.12; // 0.3 to 0.66
        const twinkleDur = 3 + (i % 5) * 0.8; // 3s to 6.2s
        const delay = (i * 0.9) % 5;
        return {
          left: `${left}%`,
          top: `${top}%`,
          size,
          opacity,
          twinkleDur,
          delay,
        };
      }),
    [bgStarCount],
  );

  return (
    <div
      className="fixed left-0 right-0 bottom-0 pointer-events-none overflow-hidden"
      style={{ top: 'var(--fs-offset-top, 51px)', zIndex: 45 }}
      aria-hidden="true"
    >
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Layer 1: static twinkling background starfield */}
      {bgStars.map((s, i) => (
        <div
          key={`bg-${i}`}
          className="fs-bgstar"
          style={{
            left: s.left,
            top: s.top,
            '--fs-bs-size': `${s.size}px`,
            '--fs-bs-op': s.opacity,
            '--fs-bs-dur': `${s.twinkleDur}s`,
            '--fs-bs-delay': `${s.delay}s`,
          } as React.CSSProperties}
        />
      ))}

      {/* Layer 2: falling meteors with tapering tails */}
      {meteors.map((m, i) => (
        <div
          key={`m-${i}`}
          className="fs-meteor"
          style={{
            left: m.left,
            top: 0,
            '--fs-len': `${m.len}px`,
            '--fs-dur': `${m.duration}s`,
            '--fs-delay': `${m.delay}s`,
            '--fs-op': m.opacity,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
