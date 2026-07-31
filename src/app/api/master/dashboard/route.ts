import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';

// GET /api/master/dashboard — business-focused operational dashboard
// Query params: ?period=mtd|ytd|custom & from=YYYY-MM-DD & to=YYYY-MM-DD
// Returns: alerts, pipeline funnel, period stats, staff workload, activity feed
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse period ─────────────────────────────────────────────────────
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'mtd';
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date = now;
    let prevPeriodStart: Date;
    let prevPeriodEnd: Date;

    if (period === 'ytd') {
      periodStart = new Date(now.getFullYear(), 0, 1); // Jan 1 this year
      prevPeriodStart = new Date(now.getFullYear() - 1, 0, 1); // Jan 1 last year
      prevPeriodEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()); // same MTD last year
    } else if (period === 'custom' && fromParam && toParam) {
      periodStart = new Date(fromParam);
      periodEnd = new Date(toParam);
      // For custom, previous period = same length immediately before
      const periodLength = periodEnd.getTime() - periodStart.getTime();
      prevPeriodStart = new Date(periodStart.getTime() - periodLength);
      prevPeriodEnd = new Date(periodStart.getTime() - 1);
    } else {
      // MTD (default)
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of this month
      prevPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 1st of last month
      prevPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // last day of last month
    }

    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ── 1. ALERTS ────────────────────────────────────────────────────────

    // Weddings expiring in 30 days
    const expiringWeddings = await db.weddingAccount.findMany({
      where: {
        accessExpiryDate: { gte: now, lte: thirtyDaysFromNow },
        accountStatus: { notIn: ['EXPIRED', 'COMPLETED'] },
      },
      select: {
        id: true, slug: true, coupleName: true, accessExpiryDate: true,
        accountStatus: true, plan: true,
      },
      orderBy: { accessExpiryDate: 'asc' },
    });

    // Upcoming wedding dates in next 30 days
    const upcomingWeddings = await db.weddingAccount.findMany({
      where: {
        weddingDate: { gte: now, lte: thirtyDaysFromNow },
        status: { in: ['ACTIVE', 'DRAFT'] },
      },
      select: {
        id: true, slug: true, coupleName: true, weddingDate: true,
        status: true, plan: true,
      },
      orderBy: { weddingDate: 'asc' },
    });

    // Inactive staff (no login in 30 days)
    const allStaff = await db.user.findMany({
      where: { role: { not: 'COUPLE' }, isActive: true },
      select: { id: true, email: true, name: true, role: true, lastLoginAt: true },
    });
    const inactiveStaff = allStaff.filter(
      (u) => !u.lastLoginAt || new Date(u.lastLoginAt) < thirtyDaysAgo,
    );

    // Draft weddings with incomplete content (< 34 content items = not fully seeded)
    const draftWeddings = await db.weddingAccount.findMany({
      where: { status: 'DRAFT' },
      select: { id: true, slug: true, coupleName: true, createdAt: true },
    });
    const incompleteDrafts: { slug: string; coupleName: string; contentCount: number }[] = [];
    for (const w of draftWeddings) {
      const contentCount = await db.weddingContent.count({ where: { weddingId: w.id } });
      if (contentCount < 30) {
        incompleteDrafts.push({ slug: w.slug, coupleName: w.coupleName, contentCount });
      }
    }

    // ── 2. PIPELINE FUNNEL ───────────────────────────────────────────────

    const accountStatusCounts = await db.weddingAccount.groupBy({
      by: ['accountStatus'],
      _count: { accountStatus: true },
    });
    const pipeline = {
      ONBOARDING: 0,
      ACTIVE: 0,
      COMPLETED: 0,
      EXPIRED: 0,
      SUSPENDED: 0,
    };
    for (const row of accountStatusCounts) {
      pipeline[row.accountStatus as keyof typeof pipeline] = row._count.accountStatus;
    }

    // ── 3. PERIOD STATS (vs previous period) ──────────────────────────────

    const newWeddingsThisPeriod = await db.weddingAccount.count({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
    });
    const newWeddingsPrevPeriod = await db.weddingAccount.count({
      where: { createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd } },
    });
    const weddingGrowthPct = newWeddingsPrevPeriod > 0
      ? Math.round(((newWeddingsThisPeriod - newWeddingsPrevPeriod) / newWeddingsPrevPeriod) * 100)
      : newWeddingsThisPeriod > 0 ? 100 : 0;

    const rsvpsThisPeriod = await db.rSVPSubmission.count({
      where: { createdAt: { gte: periodStart, lte: periodEnd } },
    });
    const rsvpsPrevPeriod = await db.rSVPSubmission.count({
      where: { createdAt: { gte: prevPeriodStart, lte: prevPeriodEnd } },
    });
    const rsvpGrowthPct = rsvpsPrevPeriod > 0
      ? Math.round(((rsvpsThisPeriod - rsvpsPrevPeriod) / rsvpsPrevPeriod) * 100)
      : rsvpsThisPeriod > 0 ? 100 : 0;

    // ── 4. STAFF WORKLOAD ────────────────────────────────────────────────

    const staffWithWeddings = await Promise.all(
      allStaff.map(async (staff) => {
        const consultantWeddings = await db.weddingAccount.count({
          where: { consultantId: staff.id },
        });
        const coordinatorWeddings = await db.weddingAccount.count({
          where: { coordinatorId: staff.id },
        });
        return {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          consultantWeddings,
          coordinatorWeddings,
          totalWeddings: consultantWeddings + coordinatorWeddings,
          lastLoginAt: staff.lastLoginAt?.toISOString() || null,
        };
      }),
    );

    // ── 5. ACTIVITY FEED (last 10 actions) ───────────────────────────────

    const activityFeed = await db.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    // ── Summary counts (for header cards) ────────────────────────────────

    const totalWeddings = await db.weddingAccount.count();
    const activeWeddings = await db.weddingAccount.count({ where: { status: 'ACTIVE' } });
    const totalRsvps = await db.rSVPSubmission.count();
    const totalWishes = await db.wish.count();

    return NextResponse.json({
      // Summary
      totalWeddings,
      activeWeddings,
      totalRsvps,
      totalWishes,
      // Alerts
      alerts: {
        expiringWeddings: expiringWeddings.map((w) => ({
          ...w,
          accessExpiryDate: w.accessExpiryDate?.toISOString() || null,
        })),
        upcomingWeddings: upcomingWeddings.map((w) => ({
          ...w,
          weddingDate: w.weddingDate.toISOString(),
        })),
        inactiveStaff: inactiveStaff.map((s) => ({
          ...s,
          lastLoginAt: s.lastLoginAt?.toISOString() || null,
        })),
        incompleteDrafts,
      },
      // Pipeline
      pipeline,
      // Period stats
      periodStats: {
        period,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        newWeddings: newWeddingsThisPeriod,
        newWeddingsPrev: newWeddingsPrevPeriod,
        weddingGrowthPct,
        rsvps: rsvpsThisPeriod,
        rsvpsPrev: rsvpsPrevPeriod,
        rsvpGrowthPct,
      },
      // Staff workload
      staffWorkload: staffWithWeddings,
      // Activity feed
      activityFeed: activityFeed.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details,
        createdAt: log.createdAt.toISOString(),
        userName: log.user?.name || 'System',
        userEmail: log.user?.email || null,
      })),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
