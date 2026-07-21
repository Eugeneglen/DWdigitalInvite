import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// Helper: get couple's wedding ID
async function getWeddingId(userId: string): Promise<string | null> {
  const wedding = await db.weddingAccount.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  return wedding?.id ?? null;
}

// GET /api/cms/content?section=hero — get content for a section
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');

    const where: Record<string, unknown> = { weddingId };
    if (section) where.section = section;

    const content = await db.weddingContent.findMany({
      where,
      orderBy: [{ section: 'asc' }, { fieldKey: 'asc' }],
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Get content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/cms/content — upsert content items (batch)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    const { items } = await req.json() as { items: { section: string; fieldKey: string; fieldValue: string; fieldType?: string }[] };

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items array required' }, { status: 400 });
    }

    const results = [];
    for (const item of items) {
      const upserted = await db.weddingContent.upsert({
        where: {
          weddingId_section_fieldKey: {
            weddingId,
            section: item.section,
            fieldKey: item.fieldKey,
          },
        },
        update: { fieldValue: item.fieldValue, fieldType: item.fieldType },
        create: {
          weddingId,
          section: item.section,
          fieldKey: item.fieldKey,
          fieldValue: item.fieldValue,
          fieldType: item.fieldType || 'TEXT',
        },
      });
      results.push(upserted);
    }

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        weddingId,
        action: 'UPDATE',
        entity: 'WeddingContent',
        details: JSON.stringify(items.map(i => `${i.section}/${i.fieldKey}`)),
      },
    });

    return NextResponse.json({ content: results });
  } catch (error) {
    console.error('Update content error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}