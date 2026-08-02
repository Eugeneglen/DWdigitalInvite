import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

async function getWeddingId(userId: string): Promise<string | null> {
  const w = await db.weddingAccount.findFirst({ where: { ownerId: userId }, select: { id: true } });
  return w?.id ?? null;
}

// GET /api/cms/rsvps?status=attending
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) return NextResponse.json({ error: 'No wedding account' }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');

    const rsvps = await db.rSVPSubmission.findMany({
      where: { weddingId },
      include: {
        guests: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Client-side status filtering based on guest responses
    let filtered = rsvps;
    if (statusFilter) {
      filtered = rsvps.filter((rsvp) => {
        const responses = rsvp.guests;
        if (responses.length === 0) return false;
        const allYes = responses.every((g) => g.attendance === 'yes');
        const allNo = responses.every((g) => g.attendance === 'no');
        if (statusFilter === 'attending') return allYes;
        if (statusFilter === 'declined') return allNo;
        if (statusFilter === 'mixed') return !allYes && !allNo;
        return true;
      });
    }

    return NextResponse.json({ rsvps: filtered, total: rsvps.length });
  } catch (error) {
    console.error('Get RSVPs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/cms/rsvps — link an RSVP to an existing guest
// Body: { rsvpId: string, guestId: string }
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) return NextResponse.json({ error: 'No wedding account' }, { status: 404 });

    const body = await req.json();
    const { rsvpId, guestId } = body;

    if (!rsvpId || !guestId) {
      return NextResponse.json({ error: 'rsvpId and guestId are required' }, { status: 400 });
    }

    // Verify the RSVP belongs to this wedding
    const rsvp = await db.rSVPSubmission.findFirst({
      where: { id: rsvpId, weddingId },
    });
    if (!rsvp) return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });

    // Verify the guest belongs to this wedding
    const guest = await db.guest.findFirst({
      where: { id: guestId, weddingId },
    });
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });

    // Link the RSVP to the guest
    await db.rSVPSubmission.update({
      where: { id: rsvpId },
      data: { guestId },
    });

    return NextResponse.json({ success: true, message: 'RSVP matched to guest' });
  } catch (error) {
    console.error('Match RSVP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/cms/rsvps — create a new guest from an unmatched RSVP
// Body: { rsvpId: string }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) return NextResponse.json({ error: 'No wedding account' }, { status: 404 });

    const body = await req.json();
    const { rsvpId } = body;

    if (!rsvpId) {
      return NextResponse.json({ error: 'rsvpId is required' }, { status: 400 });
    }

    // Get the RSVP with its guest responses
    const rsvp = await db.rSVPSubmission.findFirst({
      where: { id: rsvpId, weddingId },
      include: { guests: true },
    });
    if (!rsvp) return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });
    if (rsvp.guestId) {
      return NextResponse.json({ error: 'RSVP is already matched to a guest' }, { status: 400 });
    }

    // Determine the RSVP status from guest responses
    const responses = rsvp.guests;
    let rsvpStatus = 'PENDING';
    if (responses.length > 0) {
      const allYes = responses.every((g) => g.attendance === 'yes');
      const allNo = responses.every((g) => g.attendance === 'no');
      if (allYes) rsvpStatus = 'ATTENDING';
      else if (allNo) rsvpStatus = 'DECLINED';
      else rsvpStatus = 'PARTIAL';
    }

    // Collect dietary notes from guest responses
    const dietaryNotes = responses
      .map((g) => g.dietary)
      .filter((d): d is string => !!d && d.trim().length > 0)
      .join('; ') || null;

    // Create a new guest from the RSVP data
    const guestName = `${rsvp.firstName} ${rsvp.lastName}`.trim();
    const newGuest = await db.guest.create({
      data: {
        weddingId,
        name: guestName,
        rsvpStatus,
        plusOne: rsvp.partySize > 1,
        dietaryNotes,
        invitationCode: `RSVP-${rsvp.id.substring(0, 8)}`,
      },
    });

    // Link the RSVP to the new guest
    await db.rSVPSubmission.update({
      where: { id: rsvpId },
      data: { guestId: newGuest.id },
    });

    return NextResponse.json({ success: true, message: 'Guest created from RSVP', guestId: newGuest.id });
  } catch (error) {
    console.error('Create guest from RSVP error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}