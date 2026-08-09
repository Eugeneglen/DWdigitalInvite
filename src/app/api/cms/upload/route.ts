import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { uploadFile, isMimeTypeAllowed, getMaxFileSize, type FileCategory } from '@/lib/file-storage';
import sharp from 'sharp';

// Allow up to 60 MB request body (hero video can be 50 MB + multipart overhead)
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 80;

/** Categories whose images should be stored as base64 in DB (survives Railway deploys). */
const DB_STORED_CATEGORIES: FileCategory[] = ['hero', 'banner'];

/**
 * POST /api/cms/upload
 *
 * Accepts multipart FormData with:
 *   - file: the file data
 *   - category: hero | banner | music | gallery | story | wishes | moments | schedule | couple-photo
 *
 * For hero (image) and banner: compresses with sharp and returns a base64 data URL
 * that persists in the database across Railway container restarts.
 * For hero (video) and all other categories: saves to filesystem as before.
 *
 * Returns: { url: string, fileName: string, mimeType: string, fileSize: number, category: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get wedding ID for this user
    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    if (!wedding) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const category = (formData.get('category') as string) as FileCategory;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!category) {
      return NextResponse.json({ error: 'No category provided' }, { status: 400 });
    }

    // Validate MIME type
    if (!isMimeTypeAllowed(category, file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed for category "${category}"` },
        { status: 400 },
      );
    }

    // Validate file size
    const maxSize = getMaxFileSize(category);
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${(maxSize / 1024 / 1024).toFixed(0)} MB limit` },
        { status: 400 },
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── Hero (image) and Banner: store as base64 data URL in DB ──
    // This survives Railway container restarts (no ephemeral filesystem dependency).
    // Hero videos and all other categories still use filesystem storage.
    const isDbStored = DB_STORED_CATEGORIES.includes(category) && file.type.startsWith('image/');

    if (isDbStored) {
      const metadata = await sharp(buffer).metadata();
      const { width = 0, height = 0 } = metadata;
      const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;

      const processedBuffer = needsResize
        ? await sharp(buffer)
            .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer()
        : await sharp(buffer)
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer();

      const base64 = processedBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      return NextResponse.json({
        url: dataUrl,
        fileName: file.name,
        mimeType: 'image/jpeg',
        fileSize: processedBuffer.length,
        category,
      });
    }

    // ── All other files (hero video, gallery, music, etc.): filesystem storage ──
    const result = await uploadFile({
      weddingId: wedding.id,
      category,
      fileName: file.name,
      mimeType: file.type,
      data: buffer,
    });

    return NextResponse.json({
      url: result.url,
      fileName: result.fileName,
      mimeType: result.mimeType,
      fileSize: result.fileSize,
      category: result.category,
    });
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
