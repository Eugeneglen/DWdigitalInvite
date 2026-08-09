import { NextRequest, NextResponse } from 'next/server';
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

/** UTF-8 BOM for Excel compatibility */
const BOM = '\uFEFF';

function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((c) => {
      const s = c == null ? '' : String(c);
      return `"${s.replace(/"/g, '""')}"`;
    })
    .join(',');
}

function csvResponse(filename: string, rows: string[]): NextResponse {
  const body = BOM + rows.join('\n');
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

// GET /api/cms/export?type=guests|rsvps|wishes|contact
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') ?? '';

    switch (type) {
      // ── Guests (with RSVP data cross-populated) ─────────
      case 'guests': {
        const [guests, wishCounts] = await Promise.all([
          db.guest.findMany({
            where: { weddingId },
            include: {
              rsvps: {
                orderBy: { createdAt: 'desc' },
                take: 1, // most recent RSVP submission
                include: { guests: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          }),
          // Count wishes per guest name (Wish model has no direct Guest FK)
          db.wish.groupBy({
            by: ['name'],
            where: { weddingId },
            _count: { id: true },
          }),
        ]);
        const wishMap = new Map(wishCounts.map(w => [w.name, w._count.id]));

        const rows: string[] = [
          csvRow([
            'Name',
            'Email',
            'Phone',
            'Group',
            'Table',
            'Invitation Code',
            'RSVP Status',
            'Plus One',
            'Plus One Name',
            'Dietary Notes',
            'Sent Via',
            'Sent At',
            'Created At',
            'RSVP Submitted At',
            'Attendance',
            'Party Size',
            'Wish Count',
          ]),
        ];

        for (const g of guests) {
          const latestRsvp = g.rsvps[0];
          const attendance = latestRsvp?.guests?.[0]?.attendance
            ? (latestRsvp.guests[0].attendance === 'yes'
                ? 'Attending'
                : latestRsvp.guests[0].attendance === 'no'
                  ? 'Declined'
                  : 'Partial')
            : '';
          // Dietary: prefer Guest.dietaryNotes (synced by Fix #1),
          // fall back to latest RSVP response dietary (legacy data)
          const dietaryDisplay =
            g.dietaryNotes ||
            latestRsvp?.guests
              ?.map((gr: { dietary: string | null }) => gr.dietary)
              .filter((d: string | null): d is string => !!d)
              .join('; ') ||
            '';
          const wishCount = wishMap.get(g.name) ?? 0;
          rows.push(
            csvRow([
              g.name,
              g.email,
              g.phone,
              g.groupName,
              g.tableNumber,
              g.invitationCode,
              g.rsvpStatus,
              g.plusOne ? 'Yes' : 'No',
              g.plusOneName,
              dietaryDisplay,
              g.sentVia,
              g.sentAt?.toISOString() ?? '',
              g.createdAt.toISOString(),
              latestRsvp?.createdAt?.toISOString() ?? '',
              attendance,
              latestRsvp?.partySize ?? '',
              wishCount || '',
            ])
          );
        }

        return csvResponse(`guests-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      }

      // ── RSVPs (with Guest data cross-populated) ──────────
      case 'rsvps': {
        const rsvps = await db.rSVPSubmission.findMany({
          where: { weddingId },
          include: {
            guests: true,
            guest: { select: { id: true, name: true, invitationCode: true, groupName: true, tableNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        });

        const rows: string[] = [
          csvRow([
            'Submitted By',
            'Party Size',
            'Submitted At',
            'Linked Guest Name',
            'Invitation Code',
            'Group',
            'Table Number',
            'Guest Name',
            'Attendance',
            'Dietary',
          ]),
        ];

        for (const r of rsvps) {
          const linkedGuestName = r.guest?.name ?? '';
          const invitationCode = r.guest?.invitationCode ?? '';
          const groupName = r.guest?.groupName ?? '';
          const tableNumber = r.guest?.tableNumber ?? '';

          if (r.guests.length > 0) {
            for (const g of r.guests) {
              rows.push(
                csvRow([
                  `${r.firstName} ${r.lastName}`,
                  r.partySize,
                  r.createdAt.toISOString(),
                  linkedGuestName,
                  invitationCode,
                  groupName,
                  tableNumber,
                  g.name,
                  g.attendance === 'yes'
                    ? 'Attending'
                    : g.attendance === 'no'
                      ? 'Declined'
                      : 'Partial',
                  g.dietary,
                ])
              );
            }
          } else {
            rows.push(
              csvRow([
                `${r.firstName} ${r.lastName}`,
                r.partySize,
                r.createdAt.toISOString(),
                linkedGuestName,
                invitationCode,
                groupName,
                tableNumber,
                '—',
                '—',
                '',
              ])
            );
          }
        }

        return csvResponse(`rsvps-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      }

      // ── Wishes (with Guest data cross-populated) ─────────
      case 'wishes': {
        // Build a name → guest lookup for optional cross-reference
        const allGuests = await db.guest.findMany({
          where: { weddingId },
          select: { name: true, invitationCode: true },
        });
        const guestByName = new Map(allGuests.map(g => [g.name.toLowerCase(), g]));

        const wishes = await db.wish.findMany({
          where: { weddingId },
          orderBy: { createdAt: 'desc' },
        });

        const rows: string[] = [
          csvRow(['Name', 'Linked Guest Name', 'Invitation Code', 'Relationship', 'Message', 'Image URL', 'Created At']),
        ];

        for (const w of wishes) {
          const matchedGuest = guestByName.get(w.name.toLowerCase());
          rows.push(
            csvRow([
              w.name,
              matchedGuest?.name ?? '',
              matchedGuest?.invitationCode ?? '',
              w.relationship,
              w.message,
              w.imageUrl,
              w.createdAt.toISOString(),
            ])
          );
        }

        return csvResponse(`wishes-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      }

      // ── Contact Submissions ─────────────────────────────────
      case 'contact': {
        const contacts = await db.contactSubmission.findMany({
          where: { weddingId },
          orderBy: { createdAt: 'desc' },
        });

        const rows: string[] = [
          csvRow(['Name', 'Email', 'Contact Number', 'Reason', 'Created At']),
        ];

        for (const c of contacts) {
          rows.push(
            csvRow([
              c.name,
              c.email,
              c.contact,
              c.reason,
              c.createdAt.toISOString(),
            ])
          );
        }

        return csvResponse(`contacts-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: guests, rsvps, wishes, contact' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}