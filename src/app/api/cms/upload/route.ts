import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import sharp from 'sharp';
import {
  uploadFile,
  isMimeTypeAllowed,
  isImageMime,
  isVideoMime,
  getMaxFileSize,
  getSizeGuidance,
  type FileCategory,
} from '@/lib/file-storage';

/**
 * POST /api/cms/upload
 *
 * Uploads a file (image, video, or audio) to the local filesystem storage backend.
 * Used by the Couple CMS for Hero Visual (image OR video), Banner Design (image),
 * Music (audio), and all gallery/story/moments image uploads.
 *
 * IMAGE OPTIMISATION:
 *   Images are server-side processed via sharp before storage:
 *     - Resized to maxDimension (longest side) per category — see IMAGE_OPTIMISATION
 *     - Converted to JPEG at 82-85% quality
 *     - Resulting file is 90-98% smaller than the original
 *   Videos and audio are stored as-is (no transcoding).
 *
 * Request: multipart/form-data with fields:
 *   - file:      The file to upload (required)
 *   - category:  One of 'hero' | 'banner' | 'music' | 'gallery' | 'story' |
 *                'wishes' | 'moments' | 'schedule' | 'couple-photo' (required)
 *
 * Response (201):
 *   { url, fileName, mimeType, fileSize, category, originalSize?, optimised? }
 *
 * Response (400/401/404/500):
 *   { error: string, guidance?: string }
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve the couple's wedding — OR fall back to a "templates"
    //    storage area for admin users (who don't own a wedding but need
    //    to upload images when editing content templates).
    let weddingId: string;
    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    if (wedding) {
      weddingId = wedding.id;
    } else {
      // No wedding owned — check if the user is an admin (any platform role)
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });
      if (user && user.role.startsWith('SUPER_ADMIN') || user?.role.startsWith('CONSULTANT') || user?.role.startsWith('COORDINATOR') || user?.role.startsWith('SUPPORT')) {
        // Admin user — use a shared "templates" storage area
        weddingId = '_templates';
      } else {
        return NextResponse.json(
          { error: 'No wedding account found for this user' },
          { status: 404 },
        );
      }
    }

    // 3. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string | null) as FileCategory | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'No category provided' }, { status: 400 });
    }

    // 4. Validate category
    const VALID_CATEGORIES: FileCategory[] = [
      'hero', 'banner', 'music', 'gallery', 'story',
      'wishes', 'moments', 'schedule', 'couple-photo',
    ];
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category "${category}". Allowed: ${VALID_CATEGORIES.join(', ')}` },
        { status: 400 },
      );
    }

    // 5. Validate MIME type
    if (!isMimeTypeAllowed(category, file.type)) {
      const guidance = getSizeGuidance(category);
      return NextResponse.json(
        {
          error: `File type "${file.type}" is not allowed for category "${category}".`,
          guidance: guidance.hint,
        },
        { status: 400 },
      );
    }

    // 6. Validate file size (image-aware: hero images get 8 MB, hero videos get 50 MB)
    const maxSize = getMaxFileSize(category, file.type);
    if (file.size > maxSize) {
      const guidance = getSizeGuidance(category);
      const maxMB = (maxSize / 1024 / 1024).toFixed(0);
      const fileMB = (file.size / 1024 / 1024).toFixed(1);
      const recommendation = isImageMime(file.type)
        ? `Recommended: ${guidance.recommendedPixels} px, ${guidance.recommendedSize}.`
        : isVideoMime(file.type)
          ? `Recommended: 1080p H.264, under 30 seconds, under 30 MB.`
          : `Recommended: ${guidance.recommendedSize}.`;
      return NextResponse.json(
        {
          error: `File is ${fileMB} MB — maximum is ${maxMB} MB. ${recommendation}`,
          guidance: `${guidance.uploadLimit} · ${recommendation}`,
        },
        { status: 400 },
      );
    }

    // 7. Read file bytes
    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const originalSize = originalBuffer.length;

    // 8. Optimise images via sharp (resize + JPEG compress)
    //    Videos and audio are stored as-is.
    let finalBuffer = originalBuffer;
    let finalMimeType = file.type;
    let optimised = false;

    if (isImageMime(file.type)) {
      const config = getImageOptimisationConfig(category);
      if (config) {
        try {
          const processed = await sharp(originalBuffer)
            .resize(config.maxDimension, config.maxDimension, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: config.quality })
            .toBuffer();

          finalBuffer = processed;
          finalMimeType = 'image/jpeg';
          optimised = true;
        } catch (err) {
          console.error('Image optimisation failed, storing original:', err);
          // Fall back to storing the original unoptimised
        }
      }
    }

    // 9. Store the file via the storage backend
    const result = await uploadFile({
      weddingId: weddingId,
      category,
      fileName: file.name || `upload-${Date.now()}`,
      mimeType: finalMimeType,
      data: finalBuffer,
    });

    // 10. Return the public URL + metadata
    return NextResponse.json(
      {
        ...result,
        originalSize: optimised ? originalSize : undefined,
        optimised,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Get the image optimisation config for a category.
 * Returns null for non-image categories (music) — no processing.
 */
function getImageOptimisationConfig(category: FileCategory) {
  const configs: Record<FileCategory, { maxDimension: number; quality: number } | null> = {
    hero: { maxDimension: 1920, quality: 85 },
    banner: { maxDimension: 1920, quality: 82 },
    music: null,
    gallery: { maxDimension: 1920, quality: 82 },
    story: { maxDimension: 1600, quality: 82 },
    wishes: { maxDimension: 1600, quality: 82 },
    moments: { maxDimension: 1920, quality: 82 },
    schedule: { maxDimension: 1920, quality: 82 },
    'couple-photo': { maxDimension: 1200, quality: 85 },
  };
  return configs[category];
}
