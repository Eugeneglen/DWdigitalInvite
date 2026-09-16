import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// GET /api/guests/lookup?code=XXX
// Public endpoint — no auth required — for guests to look up their invitation.
//
// R-06 (F-06) hardening:
//   - Rate limited (10 lookups/min/IP): the invitation code functions as a
//     guest credential, so this endpoint must not be brute-forceable.
//   - PII minimisation: the response contains ONLY the fields the guest
//     invitation workflow needs (name confirmation, party size, plus-one,
//     wedding binding). Email, phone, table assignment, dietary notes and
//     group information are no longer exposed to unauthenticated callers.
export async function GET(req: Request) {
  try {
    // Rate limit: 10 lookups per minute per IP
    const ip = getClientIp(req);
    const { success, resetAt } = rateLimit(`guest-lookup:${ip}`, 10, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many lookup attempts. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code || !code.trim()) {
      return NextResponse.json(
        { error: 'Invitation code is required' },
        { status: 400 }
      );
    }

    const guest = await db.guest.findUnique({
      where: { invitationCode: code.trim().toUpperCase() },
      select: {
        name: true,
        plusOne: true,
        plusOneName: true,
        rsvpStatus: true,
        weddingId: true,
      },
    });

    if (!guest) {
      return NextResponse.json(
        { error: 'Invitation not found. Please check your code and try again.' },
        { status: 404 }
      );
    }

    // If already responded, include that info
    if (guest.rsvpStatus && guest.rsvpStatus !== 'PENDING') {
      return NextResponse.json({
        found: true,
        alreadyResponded: true,
        rsvpStatus: guest.rsvpStatus,
        guest: {
          name: guest.name,
          plusOne: guest.plusOne,
          plusOneName: guest.plusOneName,
          weddingId: guest.weddingId,
        },
      });
    }

    // Derive party size from plusOne
    const partySize = guest.plusOne ? 2 : 1;

    return NextResponse.json({
      found: true,
      alreadyResponded: false,
      guest: {
        name: guest.name,
        plusOne: guest.plusOne,
        plusOneName: guest.plusOneName,
        partySize,
        weddingId: guest.weddingId,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
