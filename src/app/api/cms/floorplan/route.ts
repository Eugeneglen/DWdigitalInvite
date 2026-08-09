import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import sharp from 'sharp';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_DIMENSION = 2000; // Resize longest side to max 2000px
const JPEG_QUALITY = 80; // 80% quality — good balance of size vs clarity

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the wedding account
    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });
    if (!wedding) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10 MB.' }, { status: 400 });
    }

    // Convert uploaded file to buffer and process with sharp
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Get image metadata to check if resize is needed
    const metadata = await sharp(fileBuffer).metadata();
    const { width = 0, height = 0 } = metadata;

    // Resize if longest side exceeds MAX_DIMENSION, then convert to JPEG
    let processedBuffer: Buffer;
    const needsResize = width > MAX_DIMENSION || height > MAX_DIMENSION;

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

    // Store as base64 data URL directly in the database (survives Railway restarts)
    const base64 = processedBuffer.toString('base64');
    const floorPlanUrl = `data:image/jpeg;base64,${base64}`;

    await db.weddingAccount.update({
      where: { id: wedding.id },
      data: { floorPlanUrl },
    });

    return NextResponse.json({ url: floorPlanUrl }, { status: 201 });
  } catch (error) {
    console.error('Floor plan upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true, floorPlanUrl: true },
    });
    if (!wedding) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    // Clear the floor plan URL from the wedding account
    await db.weddingAccount.update({
      where: { id: wedding.id },
      data: { floorPlanUrl: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Floor plan delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
