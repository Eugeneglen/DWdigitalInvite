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

// GET /api/cms/analytics
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

    // ── Guest Stats ────────────────────────────────────────────
    // Extended select to include name, email, phone, dietaryNotes for Phase 4
    const guests = await db.guest.findMany({
      where: { weddingId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        rsvpStatus: true,
        groupName: true,
        dietaryNotes: true,
        plusOne: true,
        updatedAt: true,
      },
    });

    const total = guests.length;
    const attending = guests.filter((g) => g.rsvpStatus === 'ATTENDING').length;
    const declined = guests.filter((g) => g.rsvpStatus === 'DECLINED').length;
    const pending = guests.filter((g) => g.rsvpStatus === 'PENDING').length;
    const partial = guests.filter((g) => g.rsvpStatus === 'PARTIAL').length;
    const responded = attending + declined + partial;
    const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

    // ── Wishes Count ───────────────────────────────────────────
    const wishesCount = await db.wish.count({ where: { weddingId } });

    // ── RSVP Timeline (last 90 days, grouped by date) ─────────
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const rsvpSubmissions = await db.rSVPSubmission.findMany({
      where: {
        weddingId,
        createdAt: { gte: ninetyDaysAgo },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const timelineMap = new Map<string, number>();
    for (const r of rsvpSubmissions) {
      const dateKey = r.createdAt.toISOString().slice(0, 10);
      timelineMap.set(dateKey, (timelineMap.get(dateKey) || 0) + 1);
    }

    const rsvpTimeline = Array.from(timelineMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // ── Group Breakdown ────────────────────────────────────────
    const groupMap = new Map<
      string,
      { total: number; attending: number; declined: number; pending: number }
    >();

    for (const g of guests) {
      const group = g.groupName || 'Ungrouped';
      const existing = groupMap.get(group) || {
        total: 0,
        attending: 0,
        declined: 0,
        pending: 0,
      };
      existing.total += 1;
      if (g.rsvpStatus === 'ATTENDING') existing.attending += 1;
      else if (g.rsvpStatus === 'DECLINED') existing.declined += 1;
      else existing.pending += 1;
      groupMap.set(group, existing);
    }

    const groupBreakdown = Array.from(groupMap.entries())
      .map(([group, stats]) => ({
        group,
        total: stats.total,
        attending: stats.attending,
        declined: stats.declined,
        pending: stats.pending,
        responseRate:
          stats.total > 0
            ? Math.round(
                ((stats.total - stats.pending) / stats.total) * 100
              )
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // ── Phase 4: Non-responders list (PENDING guests) ──────────
    const nonResponders = guests
      .filter((g) => !g.rsvpStatus || g.rsvpStatus === 'PENDING')
      .map((g) => ({
        id: g.id,
        name: g.name,
        groupName: g.groupName || 'Ungrouped',
        email: g.email,
        phone: g.phone,
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name));

    // ── Phase 4: Dietary requirements list ─────────────────────
    const dietaryGuests = guests
      .filter((g) => g.dietaryNotes && g.dietaryNotes.trim().length > 0)
      .map((g) => ({
        id: g.id,
        name: g.name,
        groupName: g.groupName || 'Ungrouped',
        dietaryNotes: g.dietaryNotes!,
        rsvpStatus: g.rsvpStatus || 'PENDING',
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name));

    return NextResponse.json({
      guestStats: {
        total,
        attending,
        declined,
        pending,
        partial,
        responseRate,
      },
      wishesCount,
      rsvpTimeline,
      groupBreakdown,
      // ── Phase 4 new fields (additive) ───────────────────────────
      nonResponders,
      dietaryGuests,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}