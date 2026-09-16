'use client';

import { useState, useEffect } from 'react';

/**
 * Ambient backdrop colour for hero "fit" display mode.
 *
 * When a couple chooses fit mode (show the WHOLE photo instead of cropping),
 * the hero container needs a backdrop so the letterboxed image doesn't float
 * on raw page colour. This hook samples the OUTER EDGES of the image (the
 * parts that would border the photo) and returns a soft, slightly darkened
 * average — a quiet extension of the photo's own atmosphere rather than a
 * hard colour block.
 *
 * Mirrors useImageAutoContrast's canvas-sampling pattern:
 *  - crossOrigin anonymous; CORS-tainted or failed loads return the fallback
 *  - never throws; always resolves to a usable colour
 */
export function useAmbientBackdrop(imageUrl: string, fallback: string = '#F5F0E6'): string {
  const [color, setColor] = useState<string>(fallback);

  useEffect(() => {
    if (!imageUrl) {
      setColor(fallback);
      return;
    }

    let cancelled = false;

    const analyse = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (cancelled) return;
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('no 2d context');

          const w = img.naturalWidth;
          const h = img.naturalHeight;
          if (!w || !h) throw new Error('no dimensions');

          // Draw the whole image at a small scale — cheap and sufficient.
          const scale = Math.min(1, 160 / Math.max(w, h));
          const sw = Math.max(1, Math.round(w * scale));
          const sh = Math.max(1, Math.round(h * scale));
          canvas.width = sw;
          canvas.height = sh;
          ctx.drawImage(img, 0, 0, sw, sh);

          const { data } = ctx.getImageData(0, 0, sw, sh);

          // Average the border band (outer ~12% of each edge) — these pixels
          // are what letterboxing will sit next to.
          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          let count = 0;
          const bandX = Math.max(1, Math.round(sw * 0.12));
          const bandY = Math.max(1, Math.round(sh * 0.12));

          const sample = (px: number, py: number) => {
            const idx = (py * sw + px) * 4;
            totalR += data[idx];
            totalG += data[idx + 1];
            totalB += data[idx + 2];
            count++;
          };

          for (let y = 0; y < sh; y++) {
            for (let x = 0; x < sw; x++) {
              if (x < bandX || x >= sw - bandX || y < bandY || y >= sh - bandY) {
                sample(x, y);
              }
            }
          }

          if (count === 0) throw new Error('no samples');

          // Slightly darken + desaturate toward neutral so the backdrop reads
          // as ambience, never as a competing colour field.
          const avg = (v: number) => Math.round(v * 0.82 + 20);
          const r = avg(totalR / count);
          const g = avg(totalG / count);
          const b = avg(totalB / count);

          if (!cancelled) setColor(`rgb(${r}, ${g}, ${b})`);
        } catch {
          // CORS-tainted canvas or decode failure — keep fallback
          if (!cancelled) setColor(fallback);
        }
      };

      img.onerror = () => {
        if (!cancelled) setColor(fallback);
      };

      img.src = imageUrl;
    };

    const timer = setTimeout(analyse, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [imageUrl, fallback]);

  return color;
}
