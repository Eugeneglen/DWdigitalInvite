import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

async function getWeddingId(userId: string): Promise<string | null> {
  const w = await db.weddingAccount.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  return w?.id ?? null;
}

const saveSchema = z.object({
  undoStack: z.array(z.any()),
  redoStack: z.array(z.any()),
});

// GET /api/cms/seating-history — load undo/redo stacks for the wedding
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    const history = await db.seatingHistory.findUnique({
      where: { weddingId },
    });

    if (!history) {
      return NextResponse.json({ undoStack: [], redoStack: [] });
    }

    return NextResponse.json({
      undoStack: JSON.parse(history.undoStack),
      redoStack: JSON.parse(history.redoStack),
    });
  } catch (error) {
    console.error('Get seating history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/cms/seating-history — persist undo/redo stacks
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const undoStack = JSON.stringify(parsed.data.undoStack);
    const redoStack = JSON.stringify(parsed.data.redoStack);

    await db.seatingHistory.upsert({
      where: { weddingId },
      update: { undoStack, redoStack },
      create: { weddingId, undoStack, redoStack },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save seating history error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
