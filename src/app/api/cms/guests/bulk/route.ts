import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Normalisation helper — case-insensitive, collapsed whitespace
// ---------------------------------------------------------------------------
function normalize(str: string | null | undefined): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Relationship normaliser — maps common variants to canonical values
const RELATIONSHIP_ALIASES: Record<string, string> = {
  grandparent: 'RELATIVE', grandparents: 'RELATIVE', grandma: 'RELATIVE', grandfather: 'RELATIVE',
  uncle: 'RELATIVE', aunt: 'RELATIVE', cousin: 'RELATIVE',
  university_friend: 'FRIEND', uni_friend: 'FRIEND', school_friend: 'FRIEND',
  family_friend: 'FRIEND', familyfriend: 'FRIEND', parents_friend: 'OTHER',
  acquaintance: 'OTHER', neighbor: 'OTHER', neighbour: 'OTHER',
  manager: 'COLLEAGUE', boss: 'COLLEAGUE', supervisor: 'COLLEAGUE',
  partner: 'OTHER', guest_of: 'OTHER',
};
function normalizeRelationship(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_');
  // If it already matches a standard value, return as-is
  const standard = ['PARENT', 'SIBLING', 'RELATIVE', 'FRIEND', 'COLLEAGUE', 'BUSINESS', 'OTHER'];
  if (standard.includes(upper)) return upper;
  // Try alias lookup
  const alias = RELATIONSHIP_ALIASES[raw.trim().toLowerCase().replace(/\s+/g, '_')];
  return alias || raw.trim().toUpperCase().replace(/\s+/g, '_');
}

// ---------------------------------------------------------------------------
// POST /api/cms/guests/bulk — bulk import guests from CSV data
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
      select: { id: true },
    });

    if (!wedding) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    const body = await req.json();
    const { guests: guestRows } = body as { guests: Array<Record<string, string>> };

    if (!Array.isArray(guestRows) || guestRows.length === 0) {
      return NextResponse.json({ error: 'No guest data provided' }, { status: 400 });
    }

    if (guestRows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 guests per import' }, { status: 400 });
    }

    // -----------------------------------------------------------------------
    // 1. Build lookup maps from ALL existing guests for this wedding
    // -----------------------------------------------------------------------
    const existingGuests = await db.guest.findMany({
      where: { weddingId: wedding.id },
    });

    // email (lowercased) → guest  (only for guests that have an email)
    const byEmail = new Map<string, (typeof existingGuests)[number]>();
    // phone (digits only) → guest  (only for guests that have a phone)
    const byPhone = new Map<string, (typeof existingGuests)[number]>();
    // normalized name → guest
    const byName = new Map<string, (typeof existingGuests)[number]>();
    // Set of guest IDs already matched (to avoid double-matching)
    const matchedIds = new Set<string>();

    for (const g of existingGuests) {
      if (g.email) {
        const key = normalize(g.email);
        if (key) byEmail.set(key, g);
      }
      if (g.phone) {
        const key = g.phone.replace(/\D/g, ''); // digits only
        if (key) byPhone.set(key, g);
      }
      const nkey = normalize(g.name);
      if (nkey) byName.set(nkey, g);
    }

    // Existing invitation codes to avoid collisions
    const existingCodeSet = new Set(existingGuests.map((g) => g.invitationCode));

    function generateCode(): string {
      let code: string;
      do {
        code = crypto.randomBytes(3).toString('hex').toUpperCase();
      } while (existingCodeSet.has(code));
      existingCodeSet.add(code);
      return code;
    }

    // -----------------------------------------------------------------------
    // 2. Match-merge logic
    // -----------------------------------------------------------------------
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; name: string; error: string }>,
    };

    function findExisting(email: string | null, phone: string | null, name: string): (typeof existingGuests)[number] | null {
      // Priority 1: Email match
      if (email) {
        const norm = normalize(email);
        if (norm) {
          const match = byEmail.get(norm);
          if (match && !matchedIds.has(match.id)) return match;
        }
      }
      // Priority 2: Phone match
      if (phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits) {
          const match = byPhone.get(digits);
          if (match && !matchedIds.has(match.id)) return match;
        }
      }
      // Priority 3: Exact normalized name match
      const normName = normalize(name);
      if (normName) {
        const match = byName.get(normName);
        if (match && !matchedIds.has(match.id)) return match;
      }
      return null;
    }

    /**
     * Merge strategy:
     *  - tableNumber, groupName: always update (reassignment is common)
     *  - email, phone, plusOne, plusOneName, dietaryNotes: fill gaps only
     *    (existing data is more authoritative — may be from manual edit or RSVP)
     *  - rsvpStatus, sentVia, sentAt, openedAt, invitationCode: NEVER touch
     */
    function buildMergeData(
      existing: (typeof existingGuests)[number],
      incoming: { email: string | null; phone: string | null; groupName: string | null; tableNumber: number | null; plusOne: boolean; plusOneName: string | null; dietaryNotes: string | null; chineseName: string | null; side: string | null; relationship: string | null; invitedBy: string | null; category: string | null; seatCount: number | null },
    ) {
      const data: Record<string, unknown> = {};

      // Always update: table & group (reassignment is expected)
      data.tableNumber = incoming.tableNumber;
      data.groupName = incoming.groupName;

      // Always update org fields (re-categorisation is expected on re-import)
      if (incoming.side) data.side = incoming.side;
      if (incoming.relationship) data.relationship = incoming.relationship;
      if (incoming.category) data.category = incoming.category;
      if (incoming.invitedBy) data.invitedBy = incoming.invitedBy;
      if (incoming.seatCount && incoming.seatCount > 0) data.seatCount = incoming.seatCount;

      // Fill gaps only — don't overwrite existing values
      if (!existing.email && incoming.email) data.email = incoming.email;
      if (!existing.phone && incoming.phone) data.phone = incoming.phone;
      if (!existing.chineseName && incoming.chineseName) data.chineseName = incoming.chineseName;
      if (!existing.plusOneName && incoming.plusOneName) data.plusOneName = incoming.plusOneName;
      if (!existing.dietaryNotes && incoming.dietaryNotes) data.dietaryNotes = incoming.dietaryNotes;
      // plusOne: update to true if incoming says yes (never downgrade to false)
      if (incoming.plusOne && !existing.plusOne) data.plusOne = true;

      return data;
    }

    // -----------------------------------------------------------------------
    // 3. Process each row
    // -----------------------------------------------------------------------
    for (let i = 0; i < guestRows.length; i++) {
      const row = guestRows[i];
      const name = (row.name || row.Name || '').trim();
      if (!name) {
        results.errors.push({ row: i + 1, name: 'Unknown', error: 'Name is required' });
        results.skipped++;
        continue;
      }

      const email = (row.email || row.Email || '').trim() || null;
      const phone = (row.phone || row.Phone || '').trim() || null;
      const groupName = (row.group || row.Group || row.groupName || row.GroupName || '').trim() || null;
      const chineseName = (row.chineseName || row.ChineseName || row.chinese_name || '').trim() || null;
      const sideRaw = (row.side || row.Side || '').trim().toUpperCase();
      const side = ['GROOM', 'BRIDE'].includes(sideRaw) ? sideRaw : null;
      const relationship = normalizeRelationship(row.relationship || row.Relationship);
      const invitedBy = (row.invitedBy || row.InvitedBy || row.invited_by || '').trim() || null;
      const categoryRaw = (row.category || row.Category || '').trim().toUpperCase().replace(/\s+/g, '_');
      const category = ['RELATIVES', 'FRIENDS', 'COLLEAGUES', 'BUSINESS', 'PARENTS_GUESTS', 'OTHER'].includes(categoryRaw) ? categoryRaw : null;
      const seatCount = parseInt(String(row.seatCount || row.SeatCount || '1'), 10) || 1;
      const tableNumber = row.tableNumber || row.TableNumber
        ? parseInt(String(row.tableNumber || row.TableNumber), 10) || null
        : null;
      const plusOne = row.plusOne === 'true' || row.PlusOne === 'true' || row.plus_one === 'yes' || row.plus_one === '1' || row.plusOne === true;
      const plusOneName = (row.plusOneName || row.PlusOneName || row.plus_one_name || '').trim() || null;
      const dietaryNotes = (row.dietaryNotes || row.DietaryNotes || row.dietary || row.Dietary || '').trim() || null;

      try {
        const existing = findExisting(email, phone, name);

        if (existing) {
          // --- MATCH FOUND: merge ---
          const mergeData = buildMergeData(existing, { email, phone, groupName, tableNumber, plusOne, plusOneName, dietaryNotes, chineseName, side, relationship, invitedBy, category, seatCount });

          // Skip if nothing would change (avoid unnecessary updatedAt churn)
          const hasChanges = Object.keys(mergeData).some(
            (key) => JSON.stringify(mergeData[key]) !== JSON.stringify((existing as Record<string, unknown>)[key]),
          );

          if (hasChanges) {
            await db.guest.update({ where: { id: existing.id }, data: mergeData });
            results.updated++;
          } else {
            // Identical — count as matched but no DB write needed
            results.updated++;
          }
          matchedIds.add(existing.id);
        } else {
          // --- NO MATCH: create new guest ---
          await db.guest.create({
            data: {
              weddingId: wedding.id,
              name,
              chineseName,
              email,
              phone,
              groupName,
              side,
              relationship,
              invitedBy,
              category,
              tableNumber,
              seatCount,
              plusOne,
              plusOneName,
              dietaryNotes,
              rsvpStatus: (row.rsvpStatus as string) || null,
              invitationCode: generateCode(),
            },
          });
          results.created++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to process guest';
        results.errors.push({ row: i + 1, name, error: msg });
        results.skipped++;
      }
    }

    // -----------------------------------------------------------------------
    // 4. Audit log
    // -----------------------------------------------------------------------
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        weddingId: wedding.id,
        action: 'CREATE',
        entity: 'Guest',
        details: JSON.stringify({
          type: 'bulk_import',
          created: results.created,
          updated: results.updated,
          skipped: results.skipped,
          errors: results.errors.length,
        }),
      },
    });

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('Bulk guest import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
