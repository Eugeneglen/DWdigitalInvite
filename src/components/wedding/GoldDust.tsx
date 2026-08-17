'use client';

import { useMemo, useState, useEffect } from 'react';
import type { AnimationDensity } from '@/lib/animation-registry';

const styles = `
  .gd-particle {
    background: radial-gradient(circle, rgb(212,175,55) 0%, rgb(245,230,173) 60%, transparent 100%);
    animation: gdRise var(--gd-dur,18s) linear var(--gd-delay,0s) infinite,
               gdSway var(--gd-dur,18s) ease-in-out var(--gd-delay,0s) infinite;
  }
  @keyframes gdRise {
    0%   { opacity: var(--gd-op-start,0); transform: translateY(0); }
    8%   { opacity: 1; }
    85%  { opacity: 1; }
    100% { opacity: 0; transform: translateY(-105vh); }
  }
  @keyframes gdSway {
    0%   { margin-left: 0; }
    25%  { margin-left: var(--gd-sway,12px); }
    50%  { margin-left: calc(var(--gd-sway,12px) * -0.5); }
    75%  { margin-left: var(--gd-sway,12px); }
    100% { margin-left: 0; }
  }
  /* Accessibility: guests who prefer reduced motion see no animation. */
  @media (prefers-reduced-motion: reduce) {
    .gd-particle { display: none !important; }
  }
`;

const DENSITY_COUNT: Record<AnimationDensity, number> = {
  low: 10,
  medium: 18,
  high: 26,
};

const MOBILE_PARTICLE_CAP = 12;

interface GoldDustProps {
  /** Particle density. Defaults to 'medium' (the historical count of 18). */
  density?: AnimationDensity;
}

/**
 * Ambient gold dust particles.
 * Purely decorative, pointer-events-none, sits behind all interactive elements.
 *
 * Performance safeguards:
 *   - Pure CSS animation (GPU-composited, no rAF loop).
 *   - Mobile particle cap (≤ 12 on screens < 768px).
 *   - prefers-reduced-motion: particles hidden entirely.
 */
export default function GoldDust({ density = 'medium' }: GoldDustProps) {
  // Initialise from the actual viewport on first render (client-only —
  // GuestSite is dynamically imported with ssr:false so window always exists).
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

  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: `${(i * (100 / count) + 2) % 100}%`,
        size: 2 + (i % 4),
        duration: 16 + (i % 8) * 2,
        delay: (i * 1.7) % 12,
        sway: 8 + (i % 3) * 6,
        opacity: 0.3 + (i % 3) * 0.2,
      })),
    [count],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {particles.map((p, i) => (
        <div
          key={i}
          className="gd-particle"
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            '--gd-dur': `${p.duration}s`,
            '--gd-delay': `${p.delay}s`,
            '--gd-sway': `${p.sway}px`,
            '--gd-op-start': '0',
            opacity: p.opacity,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
