import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createGuestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  groupName: z.string().optional(),
  tableNumber: z.number().int().optional(),
  plusOne: z.boolean().optional(),
  plusOneName: z.string().optional(),
  dietaryNotes: z.string().optional(),
});

const updateGuestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  groupName: z.string().optional(),
  tableNumber: z.number().int().optional(),
  rsvpStatus: z.enum(['PENDING', 'ATTENDING', 'DECLINED', 'PARTIAL']).optional(),
  plusOne: z.boolean().optional(),
  plusOneName: z.string().optional(),
  dietaryNotes: z.string().optional(),
  sentVia: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'QR', 'MANUAL']).optional(),
  sentAt: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getWeddingId(userId: string): Promise<string | null> {
  const w = await db.weddingAccount.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  return w?.id ?? null;
}

function generateInvitationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createAuditLog(
  userId: string,
  weddingId: string,
  action: string,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
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

// ---------------------------------------------------------------------------
// GET /api/cms/guests
// ---------------------------------------------------------------------------

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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const group = searchParams.get('group')?.trim() || '';

    const where: Record<string, unknown> = { weddingId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.rsvpStatus = status;
    }

    if (group) {
      where.groupName = group;
    }

    // NOTE: _count include removed — it generates a correlated subquery per guest
    // on PostgreSQL with no index on RSVPSubmission.guestId, causing timeouts on
    // constrained Railway instances. The frontend does not use this count.
    const guests = await db.guest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ guests });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Get guests error:', msg, error instanceof Error ? error.stack : '');
    return NextResponse.json({ error: 'Failed to fetch guests', details: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/cms/guests
// ---------------------------------------------------------------------------

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
    const parsed = createGuestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    // Generate a unique invitation code (retry on collision)
    let invitationCode = generateInvitationCode();
    let exists = await db.guest.findUnique({ where: { invitationCode } });
    let attempts = 0;
    while (exists && attempts < 10) {
      invitationCode = generateInvitationCode();
      exists = await db.guest.findUnique({ where: { invitationCode } });
      attempts++;
    }
    if (exists) {
      return NextResponse.json({ error: 'Failed to generate unique invitation code' }, { status: 500 });
    }

    const guest = await db.guest.create({
      data: {
        weddingId,
        invitationCode,
        rsvpStatus: 'PENDING',
        ...parsed.data,
      },
    });

    await createAuditLog(session.user.id, weddingId, 'CREATE', 'Guest', guest.id, {
      name: guest.name,
      invitationCode: guest.invitationCode,
    });

    return NextResponse.json({ guest }, { status: 201 });
  } catch (error) {
    console.error('Create guest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/cms/guests
// ---------------------------------------------------------------------------

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
    const parsed = updateGuestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { id, sentVia, ...updates } = parsed.data;
    if (!id) {
      return NextResponse.json({ error: 'Guest ID required' }, { status: 400 });
    }

    const existing = await db.guest.findFirst({ where: { id, weddingId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // If sentVia is provided, also set sentAt to now()
    const data: Record<string, unknown> = { ...updates };
    if (sentVia) {
      data.sentVia = sentVia;
      data.sentAt = new Date();
    }

    const guest = await db.guest.update({
      where: { id },
      data,
    });

    await createAuditLog(session.user.id, weddingId, 'UPDATE', 'Guest', guest.id, {
      changes: Object.keys(data),
    });

    return NextResponse.json({ guest });
  } catch (error) {
    console.error('Update guest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/cms/guests?id=xxx
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Guest ID required' }, { status: 400 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    const existing = await db.guest.findFirst({ where: { id, weddingId } });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.guest.delete({ where: { id } });

    await createAuditLog(session.user.id, weddingId, 'DELETE', 'Guest', id, {
      name: existing.name,
      invitationCode: existing.invitationCode,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete guest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}