'use client';

import { useState, useEffect, useRef } from 'react';
import { getAutoTextColor, getAutoTextColorFromRGB } from '@/lib/contrast';

interface ImageAutoContrast {
  /** Primary text colour for headline */
  textColor: string;
  /** Subtitle colour (70% opacity of primary) */
  subtitleColor: string;
  /** True while the image is being analysed */
  analysing: boolean;
  /** Text-shadow for extra readability on image backgrounds */
  textShadow: string;
}

/** Result used before/outside image analysis */
function solidResult(textColor: string): Pick<ImageAutoContrast, 'textColor' | 'subtitleColor' | 'textShadow'> {
  const isLight = textColor === '#1A1A1A';
  return {
    textColor,
    subtitleColor: isLight ? 'rgba(26, 26, 26, 0.7)' : 'rgba(232, 224, 208, 0.7)',
    textShadow: isLight ? '0 1px 3px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.5)',
  };
}

/**
 * Analyses the centre region of a background image to determine whether
 * it is predominantly light or dark, then returns the appropriate text
 * colour using the same WCAG luminance logic as the page-level contrast
 * system — but independently, based on the actual image content.
 *
 * Uses an off-screen <canvas> to sample pixel data.
 *
 * @param imageUrl background image to analyse
 * @param pageBackgroundColor optional page background colour. When the image
 *   cannot be loaded (CORS, 404 — e.g. Railway's ephemeral filesystem wiping
 *   uploads after a deploy) the banner renders directly on the PAGE
 *   background, so the fallback must contrast with the PAGE, not assume a
 *   light background. Omitted → legacy behaviour (dark text), used by the
 *   master CMS template editor where the preview pane is always light.
 */
export function useImageAutoContrast(
  imageUrl: string,
  pageBackgroundColor?: string,
): ImageAutoContrast {
  // Fallback colour when analysis is impossible — matches the page background
  // polarity when known, else the historical dark-text default.
  const fallback = pageBackgroundColor
    ? solidResult(getAutoTextColor(pageBackgroundColor))
    : solidResult('#1A1A1A');

  const [result, setResult] = useState<ImageAutoContrast>({
    ...fallback,
    analysing: true,
  });

  // True once an image has been SUCCESSFULLY analysed — page-background
  // patches must not overwrite real image-derived colours.
  const analysedOkRef = useRef(false);

  // Patch the fallback as the page background becomes known (the wedding
  // data fetch resolves after first paint). Only applies while no image
  // analysis has succeeded, and never flips the analysing flag.
  useEffect(() => {
    if (analysedOkRef.current) return;
    setResult((prev) => ({ ...fallback, analysing: prev.analysing }));
  }, [pageBackgroundColor]);

  useEffect(() => {
    analysedOkRef.current = false;

    if (!imageUrl) {
      setResult({ ...fallback, analysing: false });
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

          // Sample the centre band of the image — that's where the headline sits
          const sampleW = Math.min(img.naturalWidth, 600);
          const sampleH = Math.min(img.naturalHeight, 300);
          const sx = Math.floor((img.naturalWidth - sampleW) / 2);
          const sy = Math.floor((img.naturalHeight - sampleH) / 2);

          canvas.width = sampleW;
          canvas.height = sampleH;
          ctx.drawImage(img, sx, sy, sampleW, sampleH, 0, 0, sampleW, sampleH);

          const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

          // Compute average RGB of the sampled region
          let totalR = 0;
          let totalG = 0;
          let totalB = 0;
          const pixelCount = sampleW * sampleH;

          for (let i = 0; i < data.length; i += 4) {
            totalR += data[i];
            totalG += data[i + 1];
            totalB += data[i + 2];
          }

          const avgR = Math.round(totalR / pixelCount);
          const avgG = Math.round(totalG / pixelCount);
          const avgB = Math.round(totalB / pixelCount);

          const textColor = getAutoTextColorFromRGB(avgR, avgG, avgB);
          const isLight = textColor === '#1A1A1A';

          analysedOkRef.current = true;
          setResult({
            textColor,
            subtitleColor: isLight
              ? 'rgba(26, 26, 26, 0.7)'
              : 'rgba(232, 224, 208, 0.7)',
            analysing: false,
            textShadow: isLight
              ? '0 1px 3px rgba(0,0,0,0.1)'
              : '0 1px 4px rgba(0,0,0,0.5)',
          });
        } catch {
          // CORS tainted canvas, missing context, etc. — fall back to
          // page-background-aware colours (symmetric with the hero hook)
          if (!cancelled) setResult({ ...fallback, analysing: false });
        }
      };

      img.onerror = () => {
        // Image unreachable (404/CORS/network) — the banner then renders on
        // the PAGE background, so contrast against that instead of assuming
        // light (fixes invisible banner headlines after Railway deploys).
        if (!cancelled) setResult({ ...fallback, analysing: false });
      };

      img.src = imageUrl;
    };

    // Defer slightly to avoid blocking the initial paint
    const timer = setTimeout(analyse, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [imageUrl]);

  return result;
}
