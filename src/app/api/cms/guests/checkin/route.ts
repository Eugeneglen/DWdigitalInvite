import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod/v4';

const checkinSchema = z.object({
  guestId: z.string().min(1),
  action: z.enum(['CHECK_IN', 'UNDO', 'NO_SHOW']),
  actualPartySize: z.number().int().min(0).max(20).optional(),
});

async function getWeddingId(userId: string): Promise<string | null> {
  const w = await db.weddingAccount.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  return w?.id ?? null;
}

async function createAuditLog(userId: string, weddingId: string, action: string, entityId: string, details?: Record<string, unknown>) {
  await db.auditLog.create({
    data: { userId, weddingId, action, entity: 'Guest', entityId, details: details ? JSON.stringify(details) : undefined },
  });
}

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
    const parsed = checkinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { guestId, action, actualPartySize } = parsed.data;

    const guest = await db.guest.findFirst({ where: { id: guestId, weddingId } });
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    if (action === 'CHECK_IN') {
      updateData = {
        checkInStatus: 'CHECKED_IN',
        checkInTime: new Date(),
        actualPartySize: actualPartySize ?? guest.seatCount,
      };
    } else if (action === 'UNDO') {
      updateData = {
        checkInStatus: 'NOT_ARRIVED',
        checkInTime: null,
        actualPartySize: null,
      };
    } else if (action === 'NO_SHOW') {
      updateData = {
        checkInStatus: 'NO_SHOW',
      };
    }

    const updated = await db.guest.update({ where: { id: guestId }, data: updateData });

    await createAuditLog(session.user.id, weddingId, `CHECKIN_${action}`, guestId, {
      name: guest.name,
      actualPartySize: updateData.actualPartySize,
    });

    return NextResponse.json({ guest: updated });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/cms/guests/checkin?side=GROOM — for check-in search
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
    const side = searchParams.get('side')?.trim() || '';
    const search = searchParams.get('search')?.trim() || '';
    const rsvpOnly = searchParams.get('rsvpOnly') === 'true';

    const where: Record<string, unknown> = { weddingId };
    if (side) where.side = side;
    if (rsvpOnly) {
      where.rsvpStatus = { in: ['ATTENDING', 'PARTIAL'] };
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { chineseName: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const guests = await db.guest.findMany({
      where,
      select: {
        id: true, name: true, chineseName: true, phone: true,
        side: true, tableNumber: true, seatCount: true,
        dietaryNotes: true, isVip: true, isElderly: true,
        needsBabyChair: true, specialNotes: true,
        plusOne: true, plusOneName: true,
        rsvpStatus: true, checkInStatus: true,
        groupName: true, relationship: true,
        invitedBy: true,
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return NextResponse.json({ guests });
  } catch (error) {
    console.error('Check-in search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
