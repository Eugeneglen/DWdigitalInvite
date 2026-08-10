import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const VALID_SIDES = ['GROOM', 'BRIDE'] as const;
const VALID_RELATIONSHIPS = ['PARENT', 'SIBLING', 'RELATIVE', 'FRIEND', 'COLLEAGUE', 'BUSINESS', 'OTHER'] as const;
const VALID_CATEGORIES = ['RELATIVES', 'FRIENDS', 'COLLEAGUES', 'BUSINESS', 'PARENTS_GUESTS', 'OTHER'] as const;

const createGuestSchema = z.object({
  name: z.string().min(1),
  chineseName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  groupName: z.string().optional(),
  side: z.enum(VALID_SIDES).optional(),
  relationship: z.enum(VALID_RELATIONSHIPS).optional(),
  invitedBy: z.string().optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  tableNumber: z.number().int().optional(),
  plusOne: z.boolean().optional(),
  plusOneName: z.string().optional(),
  seatCount: z.number().int().min(1).max(20).optional(),
  dietaryNotes: z.string().optional(),
  isVip: z.boolean().optional(),
  isElderly: z.boolean().optional(),
  needsBabyChair: z.boolean().optional(),
  specialNotes: z.string().optional(),
});

const updateGuestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  chineseName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  groupName: z.string().optional(),
  side: z.enum(VALID_SIDES).optional(),
  relationship: z.enum(VALID_RELATIONSHIPS).optional(),
  invitedBy: z.string().optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  tableNumber: z.number().int().optional(),
  rsvpStatus: z.enum(['PENDING', 'ATTENDING', 'DECLINED', 'PARTIAL']).optional(),
  plusOne: z.boolean().optional(),
  plusOneName: z.string().optional(),
  seatCount: z.number().int().min(1).max(20).optional(),
  dietaryNotes: z.string().optional(),
  isVip: z.boolean().optional(),
  isElderly: z.boolean().optional(),
  needsBabyChair: z.boolean().optional(),
  specialNotes: z.string().optional(),
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
    const side = searchParams.get('side')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const tableNumber = searchParams.get('tableNumber')?.trim() || '';
    const unassigned = searchParams.get('unassigned') === 'true';
    const checkInStatus = searchParams.get('checkInStatus')?.trim() || '';
    const rsvpOnly = searchParams.get('rsvpOnly') === 'true';

    const where: Record<string, unknown> = { weddingId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { chineseName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { groupName: { contains: search } },
        { invitedBy: { contains: search } },
      ];
    }

    if (status) where.rsvpStatus = status;
    if (group) where.groupName = group;
    if (side) where.side = side;
    if (category) where.category = category;
    if (tableNumber) where.tableNumber = parseInt(tableNumber, 10);
    if (unassigned) where.tableNumber = null;
    if (checkInStatus) where.checkInStatus = checkInStatus;
    if (rsvpOnly) {
      where.rsvpStatus = { in: ['ATTENDING', 'PARTIAL'] };
    }

    const guests = await db.guest.findMany({
      where,
      select: {
        id: true, name: true, chineseName: true, email: true, phone: true,
        groupName: true, side: true, relationship: true, invitedBy: true, category: true,
        tableNumber: true, invitationCode: true, rsvpStatus: true, plusOne: true,
        plusOneName: true, seatCount: true, dietaryNotes: true, isVip: true,
        isElderly: true, needsBabyChair: true, specialNotes: true, sentVia: true,
        sentAt: true, openedAt: true, checkInStatus: true, checkInTime: true,
        actualPartySize: true, createdAt: true, updatedAt: true,
        _count: { select: { rsvps: true } },
      },
      orderBy: [{ side: 'asc' }, { groupName: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });

    return NextResponse.json({ guests });
  } catch (error) {
    console.error('Get guests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const data: Record<string, unknown> = {
      weddingId,
      invitationCode,
      rsvpStatus: 'PENDING',
      checkInStatus: 'NOT_ARRIVED',
      ...parsed.data,
    };

    // One name = one seat policy: always set seatCount to 1
    data.seatCount = 1;

    // Server-side capacity enforcement on create (count guests, not seats)
    const tableNum = data.tableNumber as number | undefined;
    if (tableNum != null) {
      const targetTable = await db.seatingTable.findFirst({
        where: { weddingId, tableNum },
      });
      if (targetTable) {
        const currentGuestCount = await db.guest.count({
          where: { weddingId, tableNumber: tableNum },
        });
        if (currentGuestCount + 1 > targetTable.capacity) {
          return NextResponse.json({
            error: `Table ${tableNum} is full — ${currentGuestCount}/${targetTable.capacity} guests already assigned. Remove a guest or increase capacity.`,
          }, { status: 409 });
        }
      }
    }

    const guest = await db.guest.create({ data });

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

    // Server-side capacity enforcement (count guests, not seats — one name = one seat)
    const newTableNumber = parsed.data.tableNumber;
    if (newTableNumber != null && newTableNumber !== existing.tableNumber) {
      const targetTable = await db.seatingTable.findFirst({
        where: { weddingId, tableNum: newTableNumber },
      });
      if (targetTable) {
        const currentGuestCount = await db.guest.count({
          where: { weddingId, tableNumber: newTableNumber },
        });
        if (currentGuestCount + 1 > targetTable.capacity) {
          return NextResponse.json({
            error: `Table ${newTableNumber} is full — ${currentGuestCount}/${targetTable.capacity} guests already assigned.`,
          }, { status: 409 });
        }
      }
    }

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
