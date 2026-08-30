/**
 * File Storage — local filesystem backend.
 *
 * Stores uploaded files under public/uploads/weddings/{weddingId}/.
 * Files are served directly by Next.js as static assets via /uploads/...
 *
 * Architecture note: this module is the single abstraction point for file
 * storage. To migrate to Railway Volume Mounts, S3, or any other backend
 * later, only this file needs to change — all callers use uploadFile()
 * and getFileUrl() without knowing the storage mechanism.
 *
 * Directory structure:
 *   public/uploads/weddings/{weddingId}/{category}/{timestamp}-{filename}.{ext}
 *
 * Example:
 *   public/uploads/weddings/cmrmvwr1c0003/hero/1785036000000-couple-photo.jpg
 *   public/uploads/weddings/cmrmvwr1c0003/music/1785036000000-first-dance.mp3
 *   public/uploads/weddings/cmrmvwr1c0003/gallery/1785036000000-1.png
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Storage root: uses Railway Volume Mount path when available (persistent
 * across deploys), falls back to public/uploads for local development.
 *
 * On Railway:
 *   - Set RAILWAY_VOLUME_MOUNT_PATH=/data (or similar) in Railway variables
 *   - Files are stored at /data/uploads/weddings/{weddingId}/{category}/
 *   - Served via /api/uploads/[...path] route (reads from the volume)
 *   - URL prefix becomes /api/uploads/weddings/...
 *
 * Locally:
 *   - Files are stored at public/uploads/weddings/{weddingId}/{category}/
 *   - Served directly by Next.js as static assets via /uploads/weddings/...
 */
const VOLUME_MOUNT_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const UPLOADS_ROOT = VOLUME_MOUNT_PATH
  ? path.join(VOLUME_MOUNT_PATH, 'uploads', 'weddings')
  : path.join(process.cwd(), 'public', 'uploads', 'weddings');
// Always serve via /api/uploads/... route to avoid conflicts with [slug] catch-all route.
const PUBLIC_URL_PREFIX = '/api/uploads/weddings';

/** Whether files are stored on a persistent volume (Railway) or local public dir. */
export const IS_VOLUME_STORAGE = !!VOLUME_MOUNT_PATH;

/**
 * Get the absolute filesystem path for a stored file URL.
 * Used by the /api/uploads/[...path] route to serve volume-stored files.
 * Handles both /uploads/weddings/... and /api/uploads/weddings/... URL formats.
 * Returns null if the URL is not a stored file URL.
 */
export function getFilePathFromUrl(url: string): string | null {
  // Handle both URL prefixes for backward compatibility
  const prefixes = ['/api/uploads/weddings', '/uploads/weddings'];
  for (const prefix of prefixes) {
    if (url.startsWith(prefix)) {
      const relativePath = url.substring(prefix.length);
      const cleanPath = relativePath.replace(/^\//, '');
      return path.join(UPLOADS_ROOT, cleanPath);
    }
  }
  return null;
}

/** Allowed file categories — determines the subdirectory. */
export type FileCategory = 'hero' | 'banner' | 'music' | 'gallery' | 'story' | 'wishes' | 'moments' | 'schedule' | 'couple-photo';

/** Allowed MIME types per category. */
const ALLOWED_MIME_TYPES: Record<FileCategory, string[]> = {
  hero: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/ogg'],
  banner: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  music: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/x-m4a'],
  gallery: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  story: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  wishes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  moments: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  schedule: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  'couple-photo': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

/**
 * Max file size per category in bytes.
 *
 * These are UPLOAD limits (the raw file the couple selects). After upload,
 * images are server-side optimised via sharp (resized + JPEG-compressed),
 * so the stored file is typically 90-98% smaller than the upload limit.
 *
 * IMAGE LIMIT RATIONALE (25 MB):
 *   The 25 MB image limit is intentionally generous because the server
 *   auto-optimises every image via sharp (resize to 1920px + JPEG 82-85%).
 *   A 25 MB iPhone ProRAW or large DSLR JPEG gets compressed to ~300-500 KB
 *   automatically — the couple never needs to pre-compress. The limit only
 *   exists to prevent abuse (e.g., uploading 100+ MB files that would crash
 *   the server during sharp processing).
 *
 *   Typical file sizes this covers:
 *     iPhone JPEG          2-4 MB    ✓
 *     Android JPEG         3-8 MB    ✓
 *     iPhone ProRAW       12-25 MB   ✓
 *     DSLR JPEG (full)    5-20 MB    ✓
 *     Medium-format RAW   20-50 MB   ✗ (too large, use JPEG export)
 *
 * VIDEO: 50 MB (hero only) — 30s 1080p H.264 ≈ 20-30 MB
 * MUSIC: 5 MB — 4 min @ 128 kbps MP3 = 3.5 MB
 */
const MAX_FILE_SIZE: Record<FileCategory, number> = {
  hero: 50 * 1024 * 1024,    // 50 MB (video) / 25 MB enforced separately for images
  banner: 25 * 1024 * 1024,  // 25 MB (images auto-optimised via sharp)
  music: 5 * 1024 * 1024,    // 5 MB
  gallery: 25 * 1024 * 1024, // 25 MB (images auto-optimised via sharp)
  story: 25 * 1024 * 1024,   // 25 MB (images auto-optimised via sharp)
  wishes: 10 * 1024 * 1024,  // 10 MB (guest uploads, slightly tighter)
  moments: 25 * 1024 * 1024, // 25 MB (images auto-optimised via sharp)
  schedule: 25 * 1024 * 1024,// 25 MB (images auto-optimised via sharp)
  'couple-photo': 25 * 1024 * 1024, // 25 MB (images auto-optimised via sharp)
};

/**
 * Image-specific upload limit (25 MB). Applied when the uploaded file is an
 * image, regardless of category. This is intentionally generous because the
 * server auto-optimises every image via sharp — a 25 MB file becomes ~300 KB.
 * Video and audio use the MAX_FILE_SIZE above.
 */
const MAX_IMAGE_UPLOAD_SIZE = 25 * 1024 * 1024; // 25 MB

/**
 * Size guidance shown to users in the CMS UI. These are RECOMMENDATIONS
 * (not hard limits) — the actual limits are MAX_FILE_SIZE above.
 *
 * `maxPixels` is the longest side after server-side resize. Images larger
 * than this are downscaled; smaller images are kept as-is.
 */
export interface SizeGuidance {
  /** Human-readable upload limit, e.g. "25 MB" */
  uploadLimit: string;
  /** Recommended max dimensions, e.g. "1920×1080" (or null for video/audio) */
  recommendedPixels: string | null;
  /** Recommended max file size for best results, e.g. "Under 5 MB" */
  recommendedSize: string;
  /** Additional guidance (bitrate, duration, format hints) */
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

/**
 * Image optimisation settings per category.
 * After upload, images are resized to `maxDimension`px (longest side) and
 * JPEG-compressed at `quality`. This reduces stored file size by 90-98%.
 *
 * `null` means no optimisation (video/audio categories, or images that
 * should be stored as-is).
 */
export interface ImageOptimisationConfig {
  maxDimension: number;
  quality: number;
}

export const IMAGE_OPTIMISATION: Record<FileCategory, ImageOptimisationConfig | null> = {
  hero: { maxDimension: 1920, quality: 85 },
  banner: { maxDimension: 1920, quality: 82 },
  music: null, // audio — no image processing
  gallery: { maxDimension: 1920, quality: 82 },
  story: { maxDimension: 1600, quality: 82 },
  wishes: { maxDimension: 1600, quality: 82 },
  moments: { maxDimension: 1920, quality: 82 },
  schedule: { maxDimension: 1920, quality: 82 },
  'couple-photo': { maxDimension: 1200, quality: 85 },
};

export interface UploadResult {
  /** The public URL path for accessing the file (e.g. /uploads/weddings/.../hero/123.mp4) */
  url: string;
  /** The original file name */
  fileName: string;
  /** The MIME type */
  mimeType: string;
  /** The file size in bytes */
  fileSize: number;
  /** The category subdirectory */
  category: FileCategory;
}

export interface UploadOptions {
  weddingId: string;
  category: FileCategory;
  fileName: string;
  mimeType: string;
  /** The file data as a Buffer (from multipart upload) */
  data: Buffer;
}

/**
 * Validate that a MIME type is allowed for the given category.
 * Returns true if allowed, false otherwise.
 */
export function isMimeTypeAllowed(category: FileCategory, mimeType: string): boolean {
  const allowed = ALLOWED_MIME_TYPES[category];
  return allowed.includes(mimeType);
}

/**
 * Check if a MIME type is an image.
 */
export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Check if a MIME type is a video.
 */
export function isVideoMime(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

/**
 * Get the max upload file size for a category + MIME type.
 *
 * For the `hero` category, the limit depends on whether the file is an
 * image (25 MB) or a video (50 MB). For all other categories, the limit
 * is fixed per category.
 */
export function getMaxFileSize(category: FileCategory, mimeType?: string): number {
  if (category === 'hero' && mimeType && isImageMime(mimeType)) {
    return MAX_IMAGE_UPLOAD_SIZE; // 25 MB for hero images
  }
  return MAX_FILE_SIZE[category];
}

/**
 * Get the size guidance for a category (for UI display + error messages).
 */
export function getSizeGuidance(category: FileCategory): SizeGuidance {
  return SIZE_GUIDANCE[category];
}

/**
 * Get the file extension from a MIME type.
 */
function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
  };
  return map[mimeType] || 'bin';
}

/**
 * Sanitize a filename for safe filesystem storage.
 * Removes path components, replaces spaces, keeps it ASCII-safe.
 */
function sanitizeFileName(name: string): string {
  let base = path.basename(name);
  // Strip existing extension so uploadFile can append the correct one
  // from the MIME type (prevents double extensions like .png.png)
  const ext = path.extname(base);
  if (ext) base = base.slice(0, -ext.length);
  const safe = base.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
  return safe.substring(0, 50) || 'file';
}

/**
 * Upload a file to the local filesystem storage backend.
 *
 * @throws Error if the MIME type is not allowed for the category
 * @throws Error if the file size exceeds the category limit
 */
export async function uploadFile(options: UploadOptions): Promise<UploadResult> {
  const { weddingId, category, fileName, mimeType, data } = options;

  // Validate MIME type
  if (!isMimeTypeAllowed(category, mimeType)) {
    throw new Error(`File type "${mimeType}" is not allowed for category "${category}". Allowed: ${ALLOWED_MIME_TYPES[category].join(', ')}`);
  }

  // Validate file size
  const maxSize = getMaxFileSize(category);
  if (data.length > maxSize) {
    throw new Error(`File size ${(data.length / 1024 / 1024).toFixed(1)} MB exceeds the ${(maxSize / 1024 / 1024).toFixed(0)} MB limit for category "${category}".`);
  }

  // Build the destination directory
  const dir = path.join(UPLOADS_ROOT, weddingId, category);
  await fs.mkdir(dir, { recursive: true });

  // Generate a unique filename: {timestamp}-{random}-{sanitized-name}.{ext}
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const ext = getExtensionFromMime(mimeType);
  const safeName = sanitizeFileName(fileName);
  const storedFileName = `${timestamp}-${random}-${safeName}.${ext}`;

  const filePath = path.join(dir, storedFileName);

  // Write the file
  await fs.writeFile(filePath, data);

  // Build the public URL
  const url = `${PUBLIC_URL_PREFIX}/${weddingId}/${category}/${storedFileName}`;

  return {
    url,
    fileName,
    mimeType,
    fileSize: data.length,
    category,
  };
}

/**
 * Delete a file from the local filesystem storage backend.
 * Silently does nothing if the file doesn't exist.
 */
export async function deleteFile(url: string): Promise<void> {
  // Convert URL to filesystem path (handle both prefixes for backward compat)
  const prefixes = ['/api/uploads/weddings', '/uploads/weddings'];
  let relativePath = '';
  for (const prefix of prefixes) {
    if (url.startsWith(prefix)) {
      relativePath = url.substring(prefix.length);
      break;
    }
  }
  if (!relativePath) return;
  const filePath = path.join(UPLOADS_ROOT, relativePath);
  try {
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist — ignore
  }
}

/**
 * Check if a URL is a data: URL (base64 inline).
 * Used by the migration script to identify old-format images.
 */
export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}

/**
 * Check if a URL is a stored file URL (from this storage backend).
 */
export function isStoredFileUrl(url: string): boolean {
  return url.startsWith('/api/uploads/weddings') || url.startsWith('/uploads/weddings');
}

/**
 * Upload a base64 data URL to the file storage backend.
 * Used by the migration script to move old base64 images to files.
 *
 * @param dataUrl The base64 data URL (e.g. "data:image/png;base64,...")
 * @param weddingId The wedding ID
 * @param category The file category
 * @param fileName The original file name (for extension hint)
 */
export async function uploadDataUrl(
  dataUrl: string,
  weddingId: string,
  category: FileCategory,
  fileName: string,
): Promise<UploadResult> {
  // Parse the data URL: data:{mime};base64,{data}
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL format');
  }
  const [, mimeType, base64Data] = match;
  const data = Buffer.from(base64Data, 'base64');
  return uploadFile({
    weddingId,
    category,
    fileName,
    mimeType,
    data,
  });
}
