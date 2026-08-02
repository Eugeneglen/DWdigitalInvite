import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — List RSVPs for a wedding (paginated, filterable)
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '15')));
    const search = searchParams.get('search') || '';
    const attendance = searchParams.get('attendance') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';

    // Build where clause
    const where: Record<string, unknown> = { weddingId };

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ];
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, unknown>).gte = new Date(fromDate);
      if (toDate) (where.createdAt as Record<string, unknown>).lte = new Date(toDate + 'T23:59:59.999Z');
    }

    // Compute summary from ALL rsvps (not just current page/filter)
    const allRsvpsForSummary = await db.rSVPSubmission.findMany({
      where: { weddingId },
      include: { guests: true },
    });
    const allGuestsForSummary = allRsvpsForSummary.flatMap((r) => r.guests);
    const summaryAttending = allGuestsForSummary.filter((g) => g.attendance === 'yes').length;
    const summaryDeclined = allGuestsForSummary.filter((g) => g.attendance === 'no').length;
    const summaryPartial = allGuestsForSummary.filter((g) => g.attendance === 'partial').length;
    const summaryTotalGuests = allGuestsForSummary.length;
    const summary = {
      totalRsvps: allRsvpsForSummary.length,
      totalGuests: summaryTotalGuests,
      attendingGuests: summaryAttending,
      declinedGuests: summaryDeclined,
      partialGuests: summaryPartial,
      attendanceRate: summaryTotalGuests > 0 ? Math.round((summaryAttending / summaryTotalGuests) * 100) : 0,
    };

    // Attendance filter — filter based on guest responses
    if (attendance) {
      const allRsvps = await db.rSVPSubmission.findMany({
        where,
        include: { guests: true },
        orderBy: { createdAt: 'desc' },
      });

      const filtered = allRsvps.filter((rsvp) => {
        if (!rsvp.guests || rsvp.guests.length === 0) return false;
        if (attendance === 'yes') return rsvp.guests.every((g) => g.attendance === 'yes');
        if (attendance === 'no') return rsvp.guests.every((g) => g.attendance === 'no');
        if (attendance === 'partial') return rsvp.guests.every((g) => g.attendance === 'partial');
        return true;
      });

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit);
      const rsvps = filtered.slice((page - 1) * limit, page * limit);

      return Response.json({
        success: true,
        data: {
          rsvps: rsvps.map((r) => ({
            id: r.id,
            weddingId: r.weddingId,
            firstName: r.firstName,
            lastName: r.lastName,
            partySize: r.partySize,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            guests: r.guests.map((g) => ({
              id: g.id,
              name: g.name,
              attendance: g.attendance,
              dietary: g.dietary,
            })),
          })),
          total,
          page,
          limit,
          totalPages,
          summary,
        },
      });
    }

    // Standard paginated query
    const [rsvpRecords, total] = await Promise.all([
      db.rSVPSubmission.findMany({
        where,
        include: { guests: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.rSVPSubmission.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return Response.json({
      success: true,
      data: {
        rsvps: rsvpRecords.map((r) => ({
          id: r.id,
          weddingId: r.weddingId,
          firstName: r.firstName,
          lastName: r.lastName,
          partySize: r.partySize,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
          guests: r.guests.map((g) => ({
            id: g.id,
            name: g.name,
            attendance: g.attendance,
            dietary: g.dietary,
          })),
        })),
        total,
        page,
        limit,
        totalPages,
        summary,
      },
    });
  } catch (err) {
    console.error('RSVPs list error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}