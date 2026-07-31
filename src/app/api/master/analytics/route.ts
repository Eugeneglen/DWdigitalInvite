import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';

// GET /api/master/analytics — business intelligence analytics
// Query params: ?period=mtd|ytd|custom & from=YYYY-MM-DD & to=YYYY-MM-DD & range=30|90|365 (legacy)
// Returns: revenue/packaging, growth, staff performance, couple engagement, RSVP analytics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:analytics:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'mtd';
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date = now;

    if (period === 'ytd') {
      rangeStart = new Date(now.getFullYear(), 0, 1);
    } else if (period === 'custom' && fromParam && toParam) {
      rangeStart = new Date(fromParam);
      rangeEnd = new Date(toParam);
    } else if (period === 'range') {
      // Legacy: ?period=range&range=30
      const rangeDays = parseInt(searchParams.get('range') || '30');
      const rangeDaysSafe = Math.min(Math.max(Number.isNaN(rangeDays) ? 30 : rangeDays, 1), 365);
      rangeStart = new Date(now.getTime() - rangeDaysSafe * 24 * 60 * 60 * 1000);
    } else {
      // MTD (default)
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const rangeDaysSafe = Math.max(Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (24 * 60 * 60 * 1000)), 1);

    // ── 1. REVENUE & PACKAGING ───────────────────────────────────────────

    // Normalize plan values: FREE→GOLD, PREMIUM→PLATINUM, keep GOLD/PLATINUM/DIAMOND
    const normalizePlan = (plan: string): string => {
      const map: Record<string, string> = { FREE: 'GOLD', PREMIUM: 'PLATINUM' };
      return map[plan] || plan;
    };

    const allWeddings = await db.weddingAccount.findMany({
      select: { id: true, plan: true, createdAt: true, status: true },
    });

    const planDistribution: { plan: string; count: number; percentage: number }[] = [];
    const planCounts: Record<string, number> = { GOLD: 0, PLATINUM: 0, DIAMOND: 0 };
    for (const w of allWeddings) {
      const normalized = normalizePlan(w.plan);
      planCounts[normalized] = (planCounts[normalized] || 0) + 1;
    }
    const totalForPct = Object.values(planCounts).reduce((a, b) => a + b, 0) || 1;
    for (const [plan, count] of Object.entries(planCounts)) {
      planDistribution.push({ plan, count, percentage: Math.round((count / totalForPct) * 100) });
    }

    // 6-month trend: new weddings per month by plan
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const recentWeddings = allWeddings.filter((w) => new Date(w.createdAt) >= sixMonthsAgo);
    const monthlyTrend: { month: string; GOLD: number; PLATINUM: number; DIAMOND: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().substring(0, 7); // YYYY-MM
      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      const monthWeddings = recentWeddings.filter(
        (w) => new Date(w.createdAt).toISOString().substring(0, 7) === monthKey,
      );
      monthlyTrend.push({
        month: monthLabel,
        GOLD: monthWeddings.filter((w) => normalizePlan(w.plan) === 'GOLD').length,
        PLATINUM: monthWeddings.filter((w) => normalizePlan(w.plan) === 'PLATINUM').length,
        DIAMOND: monthWeddings.filter((w) => normalizePlan(w.plan) === 'DIAMOND').length,
      });
    }

    // ── 2. GROWTH ────────────────────────────────────────────────────────

    // New weddings per month (12 months)
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const growthWeddings = allWeddings.filter((w) => new Date(w.createdAt) >= twelveMonthsAgo);
    const growthData: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().substring(0, 7);
      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short' });
      const count = growthWeddings.filter(
        (w) => new Date(w.createdAt).toISOString().substring(0, 7) === monthKey,
      ).length;
      growthData.push({ month: monthLabel, count });
    }

    // Active weddings over time (cumulative)
    const activeOverTime: { month: string; count: number }[] = [];
    let cumulative = 0;
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short' });
      const monthKey = monthDate.toISOString().substring(0, 7);
      const createdBeforeOrDuring = allWeddings.filter(
        (w) => new Date(w.createdAt).toISOString().substring(0, 7) <= monthKey,
      ).length;
      cumulative = createdBeforeOrDuring;
      activeOverTime.push({ month: monthLabel, count: cumulative });
    }

    // ── 3. STAFF PERFORMANCE ─────────────────────────────────────────────

    const staffUsers = await db.user.findMany({
      where: { role: { not: 'COUPLE' }, isActive: true },
      select: { id: true, name: true, email: true, role: true },
    });

    const staffPerformance = await Promise.all(
      staffUsers.map(async (staff) => {
        const assignedWeddings = await db.weddingAccount.findMany({
          where: {
            OR: [{ consultantId: staff.id }, { coordinatorId: staff.id }],
          },
          select: { id: true },
        });
        const weddingIds = assignedWeddings.map((w) => w.id);
        const rsvpCount = weddingIds.length > 0
          ? await db.rSVPSubmission.count({ where: { weddingId: { in: weddingIds } } })
          : 0;
        const auditActions = await db.auditLog.count({
          where: { userId: staff.id, createdAt: { gte: rangeStart } },
        });
        return {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          weddingsAssigned: weddingIds.length,
          rsvpsOnAssignedWeddings: rsvpCount,
          auditActionsInRange: auditActions,
        };
      }),
    );

    // ── 4. COUPLE ENGAGEMENT ─────────────────────────────────────────────

    const coupleUsers = await db.user.findMany({
      where: { role: 'COUPLE', isActive: true },
      select: { id: true, email: true, name: true, lastLoginAt: true },
    });

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoEng = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activeCouples7d = coupleUsers.filter(
      (u) => u.lastLoginAt && new Date(u.lastLoginAt) >= sevenDaysAgo,
    ).length;
    const activeCouples30d = coupleUsers.filter(
      (u) => u.lastLoginAt && new Date(u.lastLoginAt) >= thirtyDaysAgoEng,
    ).length;

    // Content completion per wedding (expected: 34 content items = 100%)
    const EXPECTED_CONTENT_ITEMS = 34;
    const weddingCompletion: { slug: string; coupleName: string; contentCount: number; completionPct: number }[] = [];
    const allWeddingAccounts = await db.weddingAccount.findMany({
      select: { id: true, slug: true, coupleName: true },
      orderBy: { createdAt: 'desc' },
    });
    for (const w of allWeddingAccounts) {
      const contentCount = await db.weddingContent.count({ where: { weddingId: w.id } });
      weddingCompletion.push({
        slug: w.slug,
        coupleName: w.coupleName,
        contentCount,
        completionPct: Math.min(Math.round((contentCount / EXPECTED_CONTENT_ITEMS) * 100), 100),
      });
    }
    const avgCompletionPct = weddingCompletion.length > 0
      ? Math.round(weddingCompletion.reduce((sum, w) => sum + w.completionPct, 0) / weddingCompletion.length)
      : 0;

    // ── 5. RSVP ANALYTICS (within date range) ────────────────────────────

    const rsvpsInRange = await db.rSVPSubmission.findMany({
      where: { createdAt: { gte: rangeStart } },
      select: { createdAt: true, partySize: true },
      orderBy: { createdAt: 'asc' },
    });

    // RSVP trend (daily, within range)
    const rsvpTrend: { date: string; count: number }[] = [];
    const rsvpMap = new Map<string, number>();
    for (let i = rangeDaysSafe - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      rsvpMap.set(d.toISOString().split('T')[0], 0);
    }
    for (const r of rsvpsInRange) {
      const key = r.createdAt.toISOString().split('T')[0];
      rsvpMap.set(key, (rsvpMap.get(key) || 0) + 1);
    }
    for (const [date, count] of rsvpMap) {
      rsvpTrend.push({ date, count });
    }

    const totalRsvpsInRange = rsvpsInRange.length;
    const totalGuestsInRange = rsvpsInRange.reduce((sum, r) => sum + r.partySize, 0);
    const avgPartySize = totalRsvpsInRange > 0 ? Math.round((totalGuestsInRange / totalRsvpsInRange) * 10) / 10 : 0;

    // ── Summary ──────────────────────────────────────────────────────────

    const totalWeddings = allWeddings.length;
    const activeWeddings = allWeddings.filter((w) => w.status === 'ACTIVE').length;
    const avgRsvpsPerWedding = totalWeddings > 0 ? Math.round((totalRsvpsInRange / totalWeddings) * 10) / 10 : 0;

    return NextResponse.json({
      range: rangeDaysSafe,
      period,
      periodStart: rangeStart.toISOString(),
      periodEnd: rangeEnd.toISOString(),
      avgRsvpsPerWedding,
      // Revenue & Packaging
      planDistribution,
      monthlyTrend,
      // Growth
      growthData,
      activeOverTime,
      // Staff Performance
      staffPerformance,
      // Couple Engagement
      coupleEngagement: {
        totalCouples: coupleUsers.length,
        activeCouples7d,
        activeCouples30d,
        avgCompletionPct,
        weddingCompletion,
      },
      // RSVP Analytics
      rsvpAnalytics: {
        totalInRange: totalRsvpsInRange,
        totalGuestsInRange,
        avgPartySize,
        trend: rsvpTrend,
      },
      // Summary
      totalWeddings,
      activeWeddings,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
