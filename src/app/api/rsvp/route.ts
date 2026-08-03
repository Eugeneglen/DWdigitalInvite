import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const guestSchema = z.object({
  name: z.string().min(1),
  attendance: z.string().default('yes'),
  dietary: z.string().optional(),
});

const rsvpSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  partySize: z.number().int().min(1).max(10),
  guests: z.array(guestSchema).min(1, 'At least one guest is required'),
  weddingId: z.string().optional(),
  // New fields for guest linking:
  guestId: z.string().optional(),         // explicit guest ID (preferred)
  invitationCode: z.string().optional(),  // resolve to guestId via lookup
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = rsvpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { firstName, lastName, partySize, guests, weddingId, guestId, invitationCode } = parsed.data;

    // Validate weddingId if provided
    if (weddingId) {
      const wedding = await db.weddingAccount.findUnique({
        where: { id: weddingId },
        select: { id: true, status: true },
      });
      if (!wedding) {
        return NextResponse.json({ error: 'Wedding not found' }, { status: 404 });
      }
      if (wedding.status !== 'ACTIVE') {
        return NextResponse.json({ error: 'Wedding is not accepting RSVPs' }, { status: 400 });
      }
    }

    // ── Guest resolution ───────────────────────────────────────────────
    // Priority: explicit guestId > invitationCode lookup > fuzzy name match > no link
    let resolvedGuestId: string | null = null;
    let resolvedGuest: { id: string; name: string; plusOne: boolean; plusOneName: string | null } | null = null;

    if (guestId) {
      // Explicit guestId provided by the form (via ?code= link)
      const g = await db.guest.findUnique({
        where: { id: guestId },
        select: { id: true, name: true, weddingId: true, plusOne: true, plusOneName: true },
      });
      if (g && (!weddingId || g.weddingId === weddingId)) {
        resolvedGuestId = g.id;
        resolvedGuest = g;
      }
    } else if (invitationCode) {
      // Invitation code provided — resolve via unique invitationCode field
      const g = await db.guest.findUnique({
        where: { invitationCode: invitationCode.trim().toUpperCase() },
        select: { id: true, name: true, weddingId: true, plusOne: true, plusOneName: true },
      });
      if (g && (!weddingId || g.weddingId === weddingId)) {
        resolvedGuestId = g.id;
        resolvedGuest = g;
      }
    } else if (weddingId) {
      // Fallback: improved fuzzy match by name (no PENDING filter — matches any guest)
      // Try exact full name match first, then fall back to first name substring
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();
      const fullName = `${trimmedFirst} ${trimmedLast}`.toLowerCase();

      const candidates = await db.guest.findMany({
        where: { weddingId },
        select: { id: true, name: true, plusOne: true, plusOneName: true },
      });

      // Exact full name match (case-insensitive)
      const exactMatch = candidates.find(
        (c) => c.name.trim().toLowerCase() === fullName
      );
      // First+last name contains match (case-insensitive)
      const nameContainsMatch = candidates.find((c) => {
        const cName = c.name.trim().toLowerCase();
        return cName.includes(fullName) || fullName.includes(cName);
      });
      // First name only match (last resort — most permissive)
      const firstNameMatch = candidates.find((c) => {
        const cName = c.name.trim().toLowerCase();
        return cName.includes(trimmedFirst.toLowerCase()) && trimmedFirst.length >= 2;
      });

      const matched = exactMatch || nameContainsMatch || firstNameMatch;
      if (matched) {
        resolvedGuestId = matched.id;
        resolvedGuest = matched;
      }
    }

    // ── Determine RSVP status for the Guest record ────────────────────
    // ATTENDING: all guests are fully attending (yes)
    // DECLINED: no guests are attending or partial
    // PARTIAL: any guest chose "partial" (ceremony only, no reception), or mixed yes/no
    const attendingCount = guests.filter((g) => g.attendance === 'yes').length;
    const partialCount = guests.filter((g) => g.attendance === 'partial').length;
    const decliningCount = guests.filter((g) => g.attendance === 'no').length;
    let guestRsvpStatus: 'ATTENDING' | 'DECLINED' | 'PARTIAL';
    if (attendingCount === 0 && partialCount === 0) {
      guestRsvpStatus = 'DECLINED';
    } else if (partialCount > 0) {
      guestRsvpStatus = 'PARTIAL';
    } else if (decliningCount === 0) {
      guestRsvpStatus = 'ATTENDING';
    } else {
      guestRsvpStatus = 'PARTIAL';
    }

    // ── Detect plus-one name from the guest list ──────────────────────
    // If the linked guest has plusOne=true and a second guest in the party was named,
    // capture that as plusOneName on the Guest record.
    let plusOneNameUpdate: string | null | undefined = undefined; // undefined = don't change
    if (resolvedGuest && resolvedGuest.plusOne && guests.length > 1) {
      // The second guest in the party is presumed to be the plus-one
      const plusOneCandidate = guests[1]?.name?.trim();
      if (plusOneCandidate && plusOneCandidate.length > 0) {
        // Only update if it's different from current value
        if (resolvedGuest.plusOneName !== plusOneCandidate) {
          plusOneNameUpdate = plusOneCandidate;
        }
      }
    }

    // ── Create the RSVP submission (with guestId if resolved) ─────────
    const submission = await db.rSVPSubmission.create({
      data: {
        firstName,
        lastName,
        partySize,
        weddingId: weddingId || null,
        guestId: resolvedGuestId, // ← THE KEY FIX: link the submission to the Guest
        guests: {
          create: guests.map((g) => ({
            name: g.name,
            attendance: g.attendance,
            dietary: g.dietary || null,
          })),
        },
      },
      include: { guests: true },
    });

    // ── Update the Guest record with the RSVP status + dietary ────────
    if (resolvedGuestId) {
      const updateData: Record<string, unknown> = {
        rsvpStatus: guestRsvpStatus,
        openedAt: new Date(),
      };
      if (plusOneNameUpdate !== undefined) {
        updateData.plusOneName = plusOneNameUpdate;
      }
      // Sync dietary preferences from RSVP responses to Guest.dietaryNotes
      const allDietary = guests
        .map(g => g.dietary)
        .filter((d): d is string => !!d && d.trim().length > 0);
      if (allDietary.length > 0) {
        updateData.dietaryNotes = allDietary.join('; ');
      }
      await db.guest.update({
        where: { id: resolvedGuestId },
        data: updateData,
      });
    }

    // Notify wedding owner about new RSVP
    if (weddingId) {
      const { notifyWeddingOwner } = await import('@/lib/notifications');
      await notifyWeddingOwner(
        weddingId,
        'RSVP_RECEIVED',
        'New RSVP Received',
        `${firstName} ${lastName} submitted an RSVP — ${attendingCount} attending, ${decliningCount} declining (party of ${partySize}).${resolvedGuestId ? '' : ' (Unmatched — no linked guest)'}`,
        'rsvps',
      );
    }

    return NextResponse.json({
      success: true,
      id: submission.id,
      guestLinked: !!resolvedGuestId,
      guestId: resolvedGuestId,
      rsvpStatus: guestRsvpStatus,
    });
  } catch (error) {
    console.error('[rsvp] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
