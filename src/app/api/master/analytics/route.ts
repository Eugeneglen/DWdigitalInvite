import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';

// GET /api/master/analytics — platform-wide analytics (SUPER_ADMIN / ACCOUNT_MANAGER)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !hasPlatformPermission(session.user.role, 'platform:analytics:read')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // KPI counts
    const totalWeddings = await db.weddingAccount.count();
    const activeWeddings = await db.weddingAccount.count({ where: { status: 'ACTIVE' } });
    const totalUsers = await db.user.count({ where: { isActive: true } });
    const totalRSVPs = await db.rSVPSubmission.count();
    const totalWishes = await db.wish.count();
    const totalContacts = await db.contactSubmission.count();
    const totalGuests = await db.guest.count();

    // RSVP trend — last 30 days grouped by date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rsvpTrendRaw = await db.rSVPSubmission.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date string (YYYY-MM-DD)
    const rsvpMap = new Map<string, number>();
    // Fill all 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      rsvpMap.set(key, 0);
    }
    for (const r of rsvpTrendRaw) {
      const key = r.createdAt.toISOString().split('T')[0];
      rsvpMap.set(key, (rsvpMap.get(key) || 0) + 1);
    }
    const rsvpTrend = Array.from(rsvpMap.entries()).map(([date, count]) => ({ date, count }));

    // Wedding status breakdown
    const statusRows = await db.weddingAccount.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const weddingStatusBreakdown: Record<string, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      SUSPENDED: 0,
      ARCHIVED: 0,
      COMPLETED: 0,
    };
    for (const row of statusRows) {
      weddingStatusBreakdown[row.status] = row._count.status;
    }

    // Plan breakdown
    const planRows = await db.weddingAccount.groupBy({
      by: ['plan'],
      _count: { plan: true },
    });
    const planBreakdown: Record<string, number> = {
      GOLD: 0,
      PLATINUM: 0,
      DIAMOND: 0,
    };
    for (const row of planRows) {
      planBreakdown[row.plan] = row._count.plan;
    }

    // Recent activity — last 10 audit log entries with user name
    const recentActivity = await db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return NextResponse.json({
      totalWeddings,
      activeWeddings,
      totalUsers,
      totalRSVPs,
      totalWishes,
      totalContacts,
      totalGuests,
      rsvpTrend,
      weddingStatusBreakdown,
      planBreakdown,
      recentActivity,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}