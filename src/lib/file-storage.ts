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

const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads', 'weddings');
const PUBLIC_URL_PREFIX = '/uploads/weddings';

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

/** Max file size per category in bytes. */
const MAX_FILE_SIZE: Record<FileCategory, number> = {
  hero: 50 * 1024 * 1024,    // 50 MB (video)
  banner: 10 * 1024 * 1024,  // 10 MB
  music: 10 * 1024 * 1024,   // 10 MB
  gallery: 10 * 1024 * 1024, // 10 MB
  story: 10 * 1024 * 1024,   // 10 MB
  wishes: 5 * 1024 * 1024,   // 5 MB
  moments: 10 * 1024 * 1024, // 10 MB
  schedule: 10 * 1024 * 1024, // 10 MB
  'couple-photo': 10 * 1024 * 1024, // 10 MB
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
 * Get the max file size for a category.
 */
export function getMaxFileSize(category: FileCategory): number {
  return MAX_FILE_SIZE[category];
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
  const base = path.basename(name);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').toLowerCase();
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
  // Convert URL to filesystem path
  if (!url.startsWith(PUBLIC_URL_PREFIX)) return;
  const relativePath = url.substring(PUBLIC_URL_PREFIX.length);
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
  return url.startsWith(PUBLIC_URL_PREFIX);
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
