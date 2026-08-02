import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — Full analytics data for a wedding
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (authError || !user) {
      return Response.json({ success: false, error: authError || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;
    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:read');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have access to this wedding.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const fromDateStr = searchParams.get('fromDate') || '';
    const toDateStr = searchParams.get('toDate') || '';

    // Date range filter
    const dateFilter: Record<string, Date | undefined> = {};
    if (fromDateStr) dateFilter.gte = new Date(fromDateStr);
    if (toDateStr) dateFilter.lte = new Date(toDateStr + 'T23:59:59.999Z');
    const hasDateFilter = fromDateStr || toDateStr;
    const dateWhere = hasDateFilter ? { createdAt: dateFilter } : {};

    // Fetch all needed data in parallel
    const [rsvps, wishes, contacts] = await Promise.all([
      db.rSVPSubmission.findMany({
        where: { weddingId, ...dateWhere },
        include: { guests: true },
        orderBy: { createdAt: 'asc' },
      }),
      db.wish.findMany({
        where: { weddingId, ...dateWhere },
        orderBy: { createdAt: 'asc' },
      }),
      db.contactSubmission.findMany({
        where: { weddingId, ...dateWhere },
      }),
    ]);

    // --- KPIs ---
    const totalRsvps = rsvps.length;
    const allGuests = rsvps.flatMap((r) => r.guests);
    const totalGuests = allGuests.length;
    const attendingGuests = allGuests.filter((g) => g.attendance === 'yes').length;
    const attendanceRate = totalGuests > 0 ? Math.round((attendingGuests / totalGuests) * 100) : 0;
    const totalWishes = wishes.length;
    const totalContacts = contacts.length;

    // --- Trends (compare to previous period) ---
    let rsvpTrend: number | null = null;
    let wishTrend: number | null = null;

    if (hasDateFilter && (fromDateStr || toDateStr)) {
      const from = fromDateStr ? new Date(fromDateStr) : new Date(0);
      const to = toDateStr ? new Date(toDateStr) : new Date();
      const periodDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
      const prevFrom = new Date(from.getTime() - periodDays * 1000 * 60 * 60 * 24);
      const prevTo = from;

      const [prevRsvpCount, prevWishCount] = await Promise.all([
        db.rSVPSubmission.count({
          where: { weddingId, createdAt: { gte: prevFrom, lt: prevTo } },
        }),
        db.wish.count({
          where: { weddingId, createdAt: { gte: prevFrom, lt: prevTo } },
        }),
      ]);

      if (prevRsvpCount > 0) rsvpTrend = Math.round(((totalRsvps - prevRsvpCount) / prevRsvpCount) * 100);
      if (prevWishCount > 0) wishTrend = Math.round(((totalWishes - prevWishCount) / prevWishCount) * 100);
    }

    // --- RSVP Timeline (daily counts) ---
    const rsvpDateMap = new Map<string, number>();
    rsvps.forEach((r) => {
      const dateKey = r.createdAt.toISOString().slice(0, 10);
      rsvpDateMap.set(dateKey, (rsvpDateMap.get(dateKey) || 0) + 1);
    });
    const rsvpTimeline = Array.from(rsvpDateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- Attendance Breakdown ---
    const yesCount = allGuests.filter((g) => g.attendance === 'yes').length;
    const noCount = allGuests.filter((g) => g.attendance === 'no').length;
    const partialCount = allGuests.filter((g) => g.attendance === 'partial').length;
    const attendanceBreakdown = [
      { name: 'Yes', value: yesCount },
      { name: 'No', value: noCount },
      { name: 'Partial', value: partialCount },
    ].filter((d) => d.value > 0);

    // --- Dietary Requirements ---
    const dietaryMap = new Map<string, number>();
    allGuests.forEach((g) => {
      if (g.dietary) {
        const d = g.dietary.trim();
        if (d) dietaryMap.set(d, (dietaryMap.get(d) || 0) + 1);
      }
    });
    const dietaryRequirements = Array.from(dietaryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // --- Party Size Distribution ---
    const partySizeMap = new Map<string, number>();
    rsvps.forEach((r) => {
      const key = r.partySize >= 5 ? '5+' : String(r.partySize);
      partySizeMap.set(key, (partySizeMap.get(key) || 0) + 1);
    });
    const partyOrder = ['1', '2', '3', '4', '5+'];
    const partySizeDistribution = partyOrder
      .filter((k) => partySizeMap.has(k))
      .map((name) => ({ name, count: partySizeMap.get(name)! }));

    // --- Wishes Timeline (cumulative) ---
    let cumulativeCount = 0;
    const wishesTimeline = wishes.map((w) => {
      cumulativeCount += 1;
      return {
        date: w.createdAt.toISOString().slice(0, 10),
        count: cumulativeCount,
      };
    });

    return Response.json({
      success: true,
      data: {
        totalRsvps,
        totalGuests,
        attendingGuests,
        attendanceRate,
        totalWishes,
        totalContacts,
        rsvpTrend,
        wishTrend,
        rsvpTimeline,
        attendanceBreakdown,
        dietaryRequirements,
        partySizeDistribution,
        wishesTimeline,
      },
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}