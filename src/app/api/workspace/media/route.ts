import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { resolveWorkspaceAccountId } from '@/lib/tenant';
import sharp from 'sharp';

export async function GET() {
  try {
    const session = await getServerSession();
    const accountId = await resolveWorkspaceAccountId(session?.user?.id);

    if (!accountId) {
      return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    // Don't return the full base64 data URL in list — too heavy.
    // Return metadata only; the frontend loads the full URL on demand.
    const media = await db.mediaAsset.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        // Return a truncated URL indicator so the UI knows the media exists
        url: true,
      },
    });

    return NextResponse.json({ media });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 80;

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const accountId = await resolveWorkspaceAccountId(session?.user?.id);

    if (!accountId) {
      return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Resize if needed, then convert to JPEG for consistent storage
    const metadata = await sharp(fileBuffer).metadata();
    const needsResize = (metadata.width ?? 0) > MAX_DIMENSION || (metadata.height ?? 0) > MAX_DIMENSION;

    let processedBuffer: Buffer;
    if (needsResize) {
      processedBuffer = await sharp(fileBuffer)
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    } else {
      processedBuffer = await sharp(fileBuffer)
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
    }

    // Store as base64 data URL directly in DB (survives Railway restarts)
    const base64 = processedBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    const media = await db.mediaAsset.create({
      data: {
        accountId,
        fileName: `${Date.now()}.jpg`,
        originalName: file.name,
        mimeType: 'image/jpeg',
        size: processedBuffer.length,
        url: dataUrl,
        uploadedById: session?.user?.id,
      },
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
