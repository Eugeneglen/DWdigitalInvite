import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

const createSchema = z.object({
  tableNum: z.number().int().positive(),
  shape: z.enum(['circle', 'rectangle', 'oval']).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  tableNum: z.number().int().positive().optional(),
  shape: z.enum(['circle', 'rectangle', 'oval']).optional(),
  capacity: z.number().int().min(1).max(50).optional(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  notes: z.string().optional(),
});

const batchUpdateSchema = z.object({
  tables: z.array(
    z.object({
      id: z.string(),
      tableNum: z.number().int().positive().optional(),
      shape: z.enum(['circle', 'rectangle', 'oval']).optional(),
      capacity: z.number().int().min(1).max(50).optional(),
      posX: z.number().optional(),
      posY: z.number().optional(),
      notes: z.string().optional(),
    })
  ),
});

async function getWeddingId(userId: string): Promise<string | null> {
  const w = await db.weddingAccount.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  return w?.id ?? null;
}

async function createAuditLog(userId: string, weddingId: string, action: string, entity: string, entityId: string, details?: Record<string, unknown>) {
  await db.auditLog.create({
    data: {
      userId,
      weddingId,
      action,
      entity,
      entityId,
      details: details ? JSON.stringify(details) : undefined,
    },
  });
}

// GET /api/cms/tables
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    const tables = await db.seatingTable.findMany({
      where: { weddingId },
      orderBy: { tableNum: 'asc' },
    });

    return NextResponse.json({ tables });
  } catch (error) {
    console.error('Get seating tables error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/cms/tables — create one
export async function POST(req: NextRequest) {
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    // Check unique tableNum
    const existing = await db.seatingTable.findUnique({
      where: { weddingId_tableNum: { weddingId, tableNum: parsed.data.tableNum } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Table number already exists' }, { status: 409 });
    }

    const table = await db.seatingTable.create({
      data: { weddingId, ...parsed.data },
    });

    await createAuditLog(session.user.id, weddingId, 'CREATE', 'SeatingTable', table.id, {
      tableNum: table.tableNum,
    });

    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    console.error('Create seating table error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/cms/tables — update one or batch
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

    // Batch update (array of tables)
    if (body.tables && Array.isArray(body.tables)) {
      const batchParsed = batchUpdateSchema.safeParse(body);
      if (!batchParsed.success) {
        return NextResponse.json({ error: batchParsed.error.issues }, { status: 400 });
      }

      const results = [];
      for (const item of batchParsed.data.tables) {
        const { id, ...updates } = item;
        // Verify ownership
        const existing = await db.seatingTable.findFirst({ where: { id, weddingId } });
        if (!existing) continue;

        // If tableNum is changing, check uniqueness
        if (updates.tableNum && updates.tableNum !== existing.tableNum) {
 const dup = await db.seatingTable.findUnique({
            where: { weddingId_tableNum: { weddingId, tableNum: updates.tableNum } },
          });
          if (dup) continue;
        }

        const updated = await db.seatingTable.update({ where: { id }, data: updates });
        results.push(updated);
      }

      return NextResponse.json({ tables: results });
    }

    // Single update
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { id, tableNum, ...updates } = parsed.data;
    if (!id) {
      return NextResponse.json({ error: 'Table ID required' }, { status: 400 });
    }

    const existing = await db.seatingTable.findFirst({ where: { id, weddingId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (tableNum && tableNum !== existing.tableNum) {
      const dup = await db.seatingTable.findUnique({
        where: { weddingId_tableNum: { weddingId, tableNum } },
      });
      if (dup) {
        return NextResponse.json({ error: 'Table number already exists' }, { status: 409 });
      }
    }

    const table = await db.seatingTable.update({
      where: { id },
      data: { ...updates, tableNum },
    });

    await createAuditLog(session.user.id, weddingId, 'UPDATE', 'SeatingTable', table.id, {
      changes: Object.keys({ ...updates, tableNum }),
    });

    return NextResponse.json({ table });
  } catch (error) {
    console.error('Update seating table error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/cms/tables?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Table ID required' }, { status: 400 });
    }

    const existing = await db.seatingTable.findFirst({ where: { id, weddingId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Unassign guests at this table
    await db.guest.updateMany({
      where: { weddingId, tableNumber: existing.tableNum },
      data: { tableNumber: null },
    });

    await db.seatingTable.delete({ where: { id } });

    await createAuditLog(session.user.id, weddingId, 'DELETE', 'SeatingTable', id, {
      tableNum: existing.tableNum,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete seating table error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
