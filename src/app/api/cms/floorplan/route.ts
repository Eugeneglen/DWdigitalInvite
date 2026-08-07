import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

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

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'floorplans');
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${wedding.id}-${Date.now()}.${ext}`;
    const filePath = path.join(uploadDir, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Store the floor plan URL on the wedding account
    const floorPlanUrl = `/uploads/floorplans/${filename}`;
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
