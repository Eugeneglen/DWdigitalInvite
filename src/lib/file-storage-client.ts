/**
 * Client-safe subset of file-storage.ts.
 *
 * This module contains ONLY the types, constants, and pure functions that
 * client components need (size guidance, MIME type checks, type definitions).
 * It does NOT import any Node.js modules (fs, path, crypto) and is safe to
 * bundle into client components.
 *
 * The full file-storage.ts (with uploadFile, deleteFile, etc.) remains
 * server-only.
 */

export type FileCategory = 'hero' | 'banner' | 'music' | 'gallery' | 'story' | 'wishes' | 'moments' | 'schedule' | 'couple-photo';

export interface SizeGuidance {
  uploadLimit: string;
  recommendedPixels: string | null;
  recommendedSize: string;
  hint: string;
}

export const SIZE_GUIDANCE: Record<FileCategory, SizeGuidance> = {
  hero: {
    uploadLimit: '25 MB (image) · 50 MB (video)',
    recommendedPixels: '1920×1080',
    recommendedSize: 'Under 5 MB (image) · Under 30 MB (video)',
    hint: 'Image: landscape, full-bleed. Video: 1080p H.264, 10-30s, silent autoplay loop. 4K not recommended. Images auto-optimised.',
  },
  banner: {
    uploadLimit: '25 MB',
    recommendedPixels: '1920×420',
    recommendedSize: 'Under 2 MB',
    hint: 'Wide banner strip (21:9 aspect). Landscape orientation. Server auto-resizes to 1920px wide + JPEG compress.',
  },
  music: {
    uploadLimit: '5 MB',
    recommendedPixels: null,
    recommendedSize: 'Under 4 MB',
    hint: 'MP3 at 128-192 kbps recommended. A 4-minute song at 128 kbps ≈ 3.5 MB. WAV/FLAC are overkill for background ambience.',
  },
  gallery: {
    uploadLimit: '25 MB',
    recommendedPixels: '1920×1080',
    recommendedSize: 'Under 3 MB',
    hint: 'Landscape or square. Displayed at ~720px in a 2-column grid. Server auto-resizes to 1920px + JPEG compress.',
  },
  story: {
    uploadLimit: '25 MB',
    recommendedPixels: '1600×1200',
    recommendedSize: 'Under 2 MB',
    hint: 'Story milestone images. Displayed at 400-900px. Server auto-resizes to 1600px + JPEG compress.',
  },
  wishes: {
    uploadLimit: '10 MB',
    recommendedPixels: '1600×1200',
    recommendedSize: 'Under 2 MB',
    hint: 'Guest-uploaded wish photos. Displayed small in masonry layout. Server auto-resizes to 1600px.',
  },
  moments: {
    uploadLimit: '25 MB',
    recommendedPixels: '1920×1080',
    recommendedSize: 'Under 3 MB',
    hint: 'Moment gallery images. Same as gallery — displayed at ~720px.',
  },
  schedule: {
    uploadLimit: '25 MB',
    recommendedPixels: '1920×1080',
    recommendedSize: 'Under 3 MB',
    hint: 'Schedule section images. Server auto-resizes to 1920px + JPEG compress.',
  },
  'couple-photo': {
    uploadLimit: '25 MB',
    recommendedPixels: '1200×1600',
    recommendedSize: 'Under 2 MB',
    hint: 'Portrait of the couple. 3:4 portrait recommended. Server auto-resizes to 1200px wide + JPEG compress.',
  },
};

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function getSizeGuidance(category: FileCategory): SizeGuidance {
  return SIZE_GUIDANCE[category];
}
