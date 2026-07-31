import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Master admin stats
    const totalWeddings = await db.weddingAccount.count();
    const activeWeddings = await db.weddingAccount.count({ where: { status: 'ACTIVE' } });
    const totalRsvps = await db.rSVPSubmission.count();
    const guestCountResult = await db.rSVPSubmission.aggregate({ _sum: { partySize: true } });
    const totalGuests = guestCountResult._sum.partySize || 0;
    const totalWishes = await db.wish.count();
    const totalContacts = await db.contactSubmission.count();
    const totalUsers = await db.user.count();

    // Recent activity
    const recentWeddings = await db.weddingAccount.findMany({
      take: 5,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, slug: true, coupleName: true, status: true, plan: true, updatedAt: true },
    });

    const recentRsvps = await db.rSVPSubmission.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { guests: true },
    });

    const recentWishes = await db.wish.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    const recentContacts = await db.contactSubmission.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    const recentAuditLogs = await db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
    });

    // Status distribution
    const statusCounts = await db.weddingAccount.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const planCounts = await db.weddingAccount.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });

    return NextResponse.json({
      totalWeddings,
      activeWeddings,
      totalRsvps,
      totalGuests,
      totalWishes,
      totalContacts,
      totalUsers,
      statusCounts,
      planCounts,
      recentWeddings,
      recentRsvps,
      recentWishes,
      recentContacts,
      recentAuditLogs,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}