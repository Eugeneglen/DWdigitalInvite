import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

async function getWeddingId(userId: string): Promise<string | null> {
  const w = await db.weddingAccount.findFirst({
    where: { ownerId: userId },
    select: { id: true },
  });
  return w?.id ?? null;
}

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

    const guests = await db.guest.findMany({
      where: { weddingId },
      select: {
        side: true,
        rsvpStatus: true,
        category: true,
        relationship: true,
        tableNumber: true,
        isVip: true,
        isElderly: true,
        needsBabyChair: true,
        checkInStatus: true,
      },
    });

    const stats = {
      total: guests.length,
      groomSide: guests.filter(g => g.side === 'GROOM').length,
      brideSide: guests.filter(g => g.side === 'BRIDE').length,
      unassignedSide: guests.filter(g => !g.side).length,
      attending: guests.filter(g => g.rsvpStatus === 'ATTENDING').length,
      declined: guests.filter(g => g.rsvpStatus === 'DECLINED').length,
      pending: guests.filter(g => g.rsvpStatus === 'PENDING' || !g.rsvpStatus).length,
      partial: guests.filter(g => g.rsvpStatus === 'PARTIAL').length,
      totalSeats: guests.length, // one name = one seat
      checkedIn: guests.filter(g => g.checkInStatus === 'CHECKED_IN').length,
      notArrived: guests.filter(g => !g.checkInStatus || g.checkInStatus === 'NOT_ARRIVED').length,
      noShow: guests.filter(g => g.checkInStatus === 'NO_SHOW').length,
      vipCount: guests.filter(g => g.isVip).length,
      elderlyCount: guests.filter(g => g.isElderly).length,
      babyChairCount: guests.filter(g => g.needsBabyChair).length,
      unassignedTable: guests.filter(g => !g.tableNumber && g.rsvpStatus !== 'DECLINED').length,
      byCategory: {} as Record<string, number>,
      byRelationship: {} as Record<string, number>,
    };

    for (const g of guests) {
      if (g.category) stats.byCategory[g.category] = (stats.byCategory[g.category] || 0) + 1;
      if (g.relationship) stats.byRelationship[g.relationship] = (stats.byRelationship[g.relationship] || 0) + 1;
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Guest stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
