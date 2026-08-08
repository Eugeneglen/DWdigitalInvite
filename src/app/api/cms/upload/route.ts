import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { uploadFile, isMimeTypeAllowed, getMaxFileSize, type FileCategory } from '@/lib/file-storage';

// Allow up to 60 MB request body (hero video can be 50 MB + multipart overhead)
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/cms/upload
 *
 * Accepts multipart FormData with:
 *   - file: the file data
 *   - category: hero | banner | music | gallery | story | wishes | moments | schedule | couple-photo
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

    // Upload via file-storage backend
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
