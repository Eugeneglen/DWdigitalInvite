import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/cms/overview — rich dashboard stats for couple
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
      include: {
        _count: { select: { guests: true, rsvps: true, wishes: true, contacts: true, media: true } },
        wishes: { take: 5, orderBy: { createdAt: 'desc' } },
        content: true,
        schedules: true,
        stories: true,
        faqs: true,
        features: true,
        media: true,
        contacts: true,
      },
    });

    if (!wedding) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    // Days until wedding
    const now = new Date();
    const weddingDate = new Date(wedding.weddingDate);
    const diffMs = weddingDate.getTime() - now.getTime();
    const daysUntil = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const isPast = diffMs < 0;

    // Guest stats — aggregated queries avoid loading all guest records
    const totalGuests = wedding._count.guests;

    const [guestStatusGroups, guestGroupRows, totalWithPlusOne] = await Promise.all([
      db.guest.groupBy({
        by: ['rsvpStatus'],
        where: { weddingId: wedding.id },
        _count: { id: true },
      }),
      db.guest.groupBy({
        by: ['groupName'],
        where: { weddingId: wedding.id },
        _count: { id: true },
      }),
      db.guest.count({
        where: { weddingId: wedding.id, plusOne: true },
      }),
    ]);

    const guestsByStatus: Record<string, number> = { PENDING: 0, ATTENDING: 0, DECLINED: 0, PARTIAL: 0 };
    for (const group of guestStatusGroups) {
      const s = group.rsvpStatus || 'PENDING';
      guestsByStatus[s] = (guestsByStatus[s] || 0) + group._count.id;
    }
    const respondedGuests = totalGuests - (guestsByStatus.PENDING || 0);
    const attendanceRate = totalGuests > 0 ? Math.round((guestsByStatus.ATTENDING / totalGuests) * 100) : 0;

    // Counts from _count (avoids loading full records)
    const totalRSVPs = wedding._count.rsvps;
    const totalWishes = wedding._count.wishes;
    const totalContacts = wedding.contacts.length;

    // Content completion — check which sections have content
    const contentSections = new Set(wedding.content.map((c) => c.section));
    const filledSections = contentSections.size;
    const totalSections = 9; // hero, schedule, story, rsvp, getting-there, qa, wishes, moments, footer
    const contentCompletion = Math.round((filledSections / totalSections) * 100);

    // Checklist items
    const checklist = [
      { key: 'details', label: 'Wedding details filled in', done: !!(wedding.coupleName && wedding.venue && wedding.weddingDate) },
      { key: 'hero_image', label: 'Hero visual uploaded', done: !!(wedding.heroImageUrl || wedding.heroVideoUrl) },
      { key: 'banner_image', label: 'Banner design uploaded', done: !!wedding.bannerUrl },
      { key: 'schedule', label: 'Event schedule created', done: wedding.schedules.length > 0 },
      { key: 'story', label: 'Love story added', done: wedding.stories.length > 0 },
      { key: 'faqs', label: 'FAQs created', done: wedding.faqs.length > 0 },
      { key: 'guests', label: 'Guest list added', done: totalGuests > 0 },
      { key: 'content', label: 'Section content written', done: filledSections >= 5 },
      { key: 'features', label: 'Features configured', done: wedding.features.some((f) => f.isEnabled) },
    ];
    const completedChecklist = checklist.filter((c) => c.done).length;
    const totalChecklist = checklist.length;

    // Recent activity (last 15 audit logs for this wedding)
    const recentActivity = await db.auditLog.findMany({
      where: { weddingId: wedding.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // Guest group distribution (top 5 groups) — from pre-fetched groupBy
    const guestGroups = guestGroupRows
      .map((row) => ({ name: row.groupName || 'Ungrouped', count: row._count.id }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // ── Phase 1: Guest list confidence + actionable KPIs ───────────────
    // These are ADDITIVE — existing response fields remain unchanged.

    // 1. Unmatched RSVPs (submissions with no guestId link)
    const unmatchedRsvps = await db.rSVPSubmission.count({
      where: { weddingId: wedding.id, guestId: null },
    });

    // 2. Confirmed headcount: attending guests + confirmed plus-ones
    //    Per user decision: plus-one is "confirmed" only if the guest keyed in
    //    the plus-one name via RSVP (plusOneName is not null/empty).
    const attendingGuests = await db.guest.count({
      where: { weddingId: wedding.id, rsvpStatus: 'ATTENDING' },
    });
    const confirmedPlusOnes = await db.guest.count({
      where: {
        weddingId: wedding.id,
        rsvpStatus: 'ATTENDING',
        plusOne: true,
        AND: [
          { plusOneName: { not: null } },
          { plusOneName: { not: '' } },
        ],
      },
    });
    const confirmedHeadcount = attendingGuests + confirmedPlusOnes;

    // 3. Dietary requirements count
    //    Counts guests with dietary either in Guest.dietaryNotes OR in their RSVP GuestResponse.dietary
    const [guestsWithDietaryNotes, guestsRsvpsWithDietary] = await Promise.all([
      db.guest.findMany({
        where: { weddingId: wedding.id, dietaryNotes: { not: '' } },
        select: { id: true },
      }),
      db.guest.findMany({
        where: {
          weddingId: wedding.id,
          rsvps: {
            some: {
              guests: {
                some: {
                  dietary: { not: null, not: '' },
                },
              },
            },
          },
        },
        select: { id: true },
      }),
    ]);
    const dietaryGuestIds = new Set([
      ...guestsWithDietaryNotes.map((g) => g.id),
      ...guestsRsvpsWithDietary.map((g) => g.id),
    ]);
    const dietaryCount = dietaryGuestIds.size;

    // 4. Pending follow-ups (guests who haven't responded)
    const pendingFollowUps = guestsByStatus.PENDING || 0;

    // 5. New wishes this week (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newWishesThisWeek = await db.wish.count({
      where: { weddingId: wedding.id, createdAt: { gte: sevenDaysAgo } },
    });

    // 6. Guest list confidence assessment
    //    EMPTY: no guests uploaded
    //    INCOMPLETE: guests exist but list is too small OR more RSVPs than guests*1.2
    //    RELIABLE: guests >= 10 AND rsvps <= guests * 1.2
    let guestListConfidence: 'EMPTY' | 'INCOMPLETE' | 'RELIABLE';
    if (totalGuests === 0) {
      guestListConfidence = 'EMPTY';
    } else if (totalGuests < 10 || totalRSVPs > totalGuests * 1.2) {
      guestListConfidence = 'INCOMPLETE';
    } else {
      guestListConfidence = 'RELIABLE';
    }

    // 7. Recent guest activity (replaces audit log in Phase 3 — for now, additive)
    //    Merges recent RSVP submissions + recent wishes, sorted by date.
    const [recentRsvps, recentWishes] = await Promise.all([
      db.rSVPSubmission.findMany({
        where: { weddingId: wedding.id },
        select: { id: true, firstName: true, lastName: true, partySize: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.wish.findMany({
        where: { weddingId: wedding.id },
        select: { id: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);
    const recentGuestActivity = [
      ...recentRsvps.map((r) => ({
        id: r.id,
        type: 'rsvp' as const,
        name: `${r.firstName} ${r.lastName}`.trim(),
        action: `RSVP'd for ${r.partySize} guest${r.partySize !== 1 ? 's' : ''}`,
        createdAt: r.createdAt.toISOString(),
      })),
      ...recentWishes.map((w) => ({
        id: w.id,
        type: 'wish' as const,
        name: w.name,
        action: 'sent a wish',
        createdAt: w.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

    // 8. RSVP deadline (from content section 'rsvp', fieldKey 'deadline')
    const rsvpDeadlineContent = wedding.content.find(
      (c) => c.section === 'rsvp' && c.fieldKey === 'deadline'
    );
    const rsvpDeadline = rsvpDeadlineContent?.fieldValue || null;

    return NextResponse.json({
      daysUntil,
      isPast,
      weddingDate: wedding.weddingDate,
      coupleName: wedding.coupleName,
      venue: wedding.venue,
      status: wedding.status,
      guests: {
        total: totalGuests,
        byStatus: guestsByStatus,
        responded: respondedGuests,
        attendanceRate,
        groups: guestGroups,
        totalWithPlusOne,
      },
      rsvps: { total: totalRSVPs },
      wishes: { total: totalWishes },
      contacts: { total: totalContacts },
      content: { completion: contentCompletion, filledSections, totalSections },
      checklist: { items: checklist, completed: completedChecklist, total: totalChecklist },
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        details: log.details,
        createdAt: log.createdAt,
        userName: log.user?.name || 'System',
      })),
      media: { total: wedding.media.length },
      // ── Phase 1 new fields (additive) ───────────────────────────────
      guestListConfidence,
      unmatchedRsvps,
      confirmedHeadcount,
      confirmedPlusOnes,
      dietaryCount,
      pendingFollowUps,
      newWishesThisWeek,
      rsvpDeadline,
      recentGuestActivity,
    });
  } catch (error) {
    console.error('Overview API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}