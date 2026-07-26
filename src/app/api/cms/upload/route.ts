import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  uploadFile,
  isMimeTypeAllowed,
  getMaxFileSize,
  type FileCategory,
} from '@/lib/file-storage';

/**
 * POST /api/cms/upload
 *
 * Multipart file upload for hero image/video, banner, music, and gallery.
 * The file is stored on the local filesystem under public/uploads/weddings/{weddingId}/{category}/
 * and a public URL is returned.
 *
 * Body (multipart/form-data):
 *   - file: the uploaded file
 *   - category: 'hero' | 'banner' | 'music' | 'gallery' | 'story' | 'wishes'
 *
 * Returns: { url, fileName, mimeType, fileSize, category }
 *
 * Auth: couple (COUPLE role) or admin (SUPER_ADMIN, ADMIN_1, ADMIN_2).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve the wedding ID for the current user
    let weddingId: string | null = null;
    if (session.user.role === 'COUPLE') {
      const wedding = await db.weddingAccount.findFirst({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      weddingId = wedding?.id ?? null;
    } else {
      // Admins must pass a weddingId query param
      const url = new URL(req.url);
      const queryWeddingId = url.searchParams.get('weddingId');
      if (queryWeddingId) {
        const wedding = await db.weddingAccount.findUnique({
          where: { id: queryWeddingId },
          select: { id: true },
        });
        weddingId = wedding?.id ?? null;
      }
    }

    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file');
    const category = formData.get('category') as string;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    // Validate category
    const validCategories: FileCategory[] = ['hero', 'banner', 'music', 'gallery', 'story', 'wishes', 'moments', 'schedule', 'couple-photo'];
    if (!validCategories.includes(category as FileCategory)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 },
      );
    }

    const typedCategory = category as FileCategory;

    // Validate MIME type
    if (!isMimeTypeAllowed(typedCategory, file.type)) {
      return NextResponse.json(
        { error: `File type "${file.type}" is not allowed for category "${category}"` },
        { status: 400 },
      );
    }

    // Validate file size
    const maxSize = getMaxFileSize(typedCategory);
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File size ${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${(maxSize / 1024 / 1024).toFixed(0)} MB limit` },
        { status: 400 },
      );
    }

    // Read file data into a Buffer
    const arrayBuffer = await file.arrayBuffer();
    const data = Buffer.from(arrayBuffer);

    // Upload to the storage backend
    const result = await uploadFile({
      weddingId,
      category: typedCategory,
      fileName: file.name,
      mimeType: file.type,
      data,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
