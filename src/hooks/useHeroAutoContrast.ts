'use client';

import { useState, useEffect, useRef } from 'react';
import { getAutoTextColorFromRGB } from '@/lib/contrast';

export interface HeroAutoContrastResult {
  /** Primary text colour — date badge, countdown numbers, description */
  textColor: string;
  /** Muted/secondary text — labels, scroll indicator */
  textColorMuted: string;
  /** Border colour for countdown cards, date badge */
  borderColor: string;
  /** Text-shadow for extra readability */
  textShadow: string;
  /** Strong text-shadow for countdown numbers */
  textShadowStrong: string;
  /** Semi-transparent card background for countdown cells */
  cardBg: string;
  /** True while the image is being analysed */
  analysing: boolean;
  /** True when the hero image is dark */
  isDark: boolean;
}

const DARK_RESULT: HeroAutoContrastResult = {
  textColor: '#E8E0D0',
  textColorMuted: 'rgba(232, 224, 208, 0.8)',
  borderColor: 'rgba(232, 213, 181, 0.4)',
  textShadow: '0 1px 6px rgba(0,0,0,0.5), 0 0px 12px rgba(0,0,0,0.25)',
  textShadowStrong: '0 2px 8px rgba(0,0,0,0.6), 0 0px 16px rgba(0,0,0,0.3)',
  cardBg: 'rgba(0, 0, 0, 0.25)',
  analysing: false,
  isDark: true,
};

const LIGHT_RESULT: HeroAutoContrastResult = {
  textColor: '#1A1A1A',
  textColorMuted: 'rgba(26, 26, 26, 0.75)',
  borderColor: 'rgba(26, 26, 26, 0.2)',
  textShadow: '0 1px 3px rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.08)',
  textShadowStrong: '0 2px 4px rgba(255,255,255,0.9), 0 1px 3px rgba(0,0,0,0.1)',
  cardBg: 'rgba(255, 255, 255, 0.3)',
  analysing: false,
  isDark: false,
};

const ANALYSING_DARK: HeroAutoContrastResult = {
  ...DARK_RESULT,
  analysing: true,
};

/**
 * Analyses the BOTTOM-CENTER region of the hero image (where the text
 * overlay actually sits) to determine whether the background is light or dark.
 *
 * For videos, it samples the first frame after the video loads.
 *
 * Returns a full set of design tokens for the hero overlay: text colours,
 * borders, text-shadows, and card backgrounds.
 */
export function useHeroAutoContrast(
  imageUrl: string,
  videoUrl?: string | null,
): HeroAutoContrastResult {
  const [result, setResult] = useState<HeroAutoContrastResult>(DARK_RESULT);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    // Re-use a single off-screen canvas across analyses
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }

    let cancelled = false;

    function analysePixelData(
      imgW: number,
      imgH: number,
      drawSource: CanvasImageSource,
    ) {
      if (cancelled) return;

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        if (!cancelled) setResult(DARK_RESULT);
        return;
      }

      // Sample the BOTTOM-CENTER of the image — that's where text sits
      // Use a wide horizontal strip covering the bottom 45% of the image
      const sampleH = Math.min(Math.round(imgH * 0.45), 500);
      const sampleW = Math.min(imgW, 800);
      const sx = Math.floor((imgW - sampleW) / 2);
      const sy = imgH - sampleH;

      canvas.width = sampleW;
      canvas.height = sampleH;
      ctx.drawImage(drawSource, sx, sy, sampleW, sampleH, 0, 0, sampleW, sampleH);

      let totalR = 0;
      let totalG = 0;
      let totalB = 0;
      const pixelCount = sampleW * sampleH;

      try {
        const { data } = ctx.getImageData(0, 0, sampleW, sampleH);

        // Weighted sampling: give more importance to pixels at the very bottom
        // (closest to the text) by reading every pixel but weighting bottom rows higher
        let weightSum = 0;
        for (let y = 0; y < sampleH; y++) {
          const rowWeight = 0.5 + 0.5 * (y / sampleH); // 0.5 at top → 1.0 at bottom
          for (let x = 0; x < sampleW; x++) {
            const i = (y * sampleW + x) * 4;
            totalR += data[i] * rowWeight;
            totalG += data[i + 1] * rowWeight;
            totalB += data[i + 2] * rowWeight;
            weightSum += rowWeight;
          }
        }

        const avgR = Math.round(totalR / weightSum);
        const avgG = Math.round(totalG / weightSum);
        const avgB = Math.round(totalB / weightSum);

        const textColor = getAutoTextColorFromRGB(avgR, avgG, avgB);
        const isDark = textColor !== '#1A1A1A';

        if (!cancelled) {
          setResult(isDark ? DARK_RESULT : LIGHT_RESULT);
        }
      } catch {
        // CORS or other error — default to dark-friendly (cream text)
        if (!cancelled) setResult(DARK_RESULT);
      }
    }

    // ── VIDEO path ──
    if (videoUrl) {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.preload = 'auto';

      const onLoaded = () => {
        if (cancelled) return;
        // Seek to 0.5s to get a representative frame (first frame might be black)
        video.currentTime = 0.5;
      };

      const onSeeked = () => {
        if (cancelled) return;
        try {
          analysePixelData(video.videoWidth, video.videoHeight, video);
        } catch {
          if (!cancelled) setResult(DARK_RESULT);
        }
        cleanup();
      };

      const onError = () => {
        if (!cancelled) setResult(DARK_RESULT);
        cleanup();
      };

      const cleanup = () => {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        video.src = '';
        video.load();
      };

      video.addEventListener('loadeddata', onLoaded);
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      video.src = videoUrl;
      video.load();

      return () => {
        cancelled = true;
        cleanup();
      };
    }

    // ── IMAGE path ──
    if (imageUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        if (cancelled) return;
        try {
          analysePixelData(img.naturalWidth, img.naturalHeight, img);
        } catch {
          if (!cancelled) setResult(DARK_RESULT);
        }
      };

      img.onerror = () => {
        if (!cancelled) setResult(DARK_RESULT);
      };

      img.src = imageUrl;

      return () => {
        cancelled = true;
      };
    }

    // No image or video — keep the default (already DARK_RESULT from initial state)
    return undefined;
  }, [imageUrl, videoUrl]);

  return result;
}
