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

const VALID_SIDES = new Set(['GROOM', 'BRIDE']);
const VALID_CATEGORIES = new Set(['RELATIVES', 'FRIENDS', 'COLLEAGUES', 'BUSINESS', 'PARENTS_GUESTS', 'OTHER']);
const VALID_RELATIONSHIPS = new Set(['PARENT', 'SIBLING', 'RELATIVE', 'FRIEND', 'COLLEAGUE', 'BUSINESS', 'OTHER']);

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
    const { guests: guestRows } = body as { guests: Array<Record<string, unknown>> };

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

    const byEmail = new Map<string, (typeof existingGuests)[number]>();
    const byPhone = new Map<string, (typeof existingGuests)[number]>();
    const byName = new Map<string, (typeof existingGuests)[number]>();
    const matchedIds = new Set<string>();

    for (const g of existingGuests) {
      if (g.email) {
        const key = normalize(g.email);
        if (key) byEmail.set(key, g);
      }
      if (g.phone) {
        const key = g.phone.replace(/\D/g, '');
        if (key) byPhone.set(key, g);
      }
      const nkey = normalize(g.name);
      if (nkey) byName.set(nkey, g);
    }

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
    // 2. Extract & validate a field from the raw row
    // -----------------------------------------------------------------------
    function str(v: unknown): string {
      return typeof v === 'string' ? v.trim() : '';
    }
    function strOrNull(v: unknown): string | null {
      const s = str(v);
      return s || null;
    }
    function intOrNull(v: unknown): number | null {
      if (v === null || v === undefined) return null;
      const n = parseInt(String(v), 10);
      return isNaN(n) ? null : n;
    }
    function bool(v: unknown): boolean {
      if (typeof v === 'boolean') return v;
      return ['yes', 'true', '1', 'y'].includes(str(v).toLowerCase());
    }
    function enumOrUndefined(v: unknown, validSet: Set<string>): string | undefined {
      const upper = str(v).toUpperCase().trim();
      return validSet.has(upper) ? upper : undefined;
    }

    // -----------------------------------------------------------------------
    // 3. Match-merge logic
    // -----------------------------------------------------------------------
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; name: string; error: string }>,
    };

    function findExisting(email: string | null, phone: string | null, name: string): (typeof existingGuests)[number] | null {
      if (email) {
        const norm = normalize(email);
        if (norm) {
          const match = byEmail.get(norm);
          if (match && !matchedIds.has(match.id)) return match;
        }
      }
      if (phone) {
        const digits = phone.replace(/\D/g, '');
        if (digits) {
          const match = byPhone.get(digits);
          if (match && !matchedIds.has(match.id)) return match;
        }
      }
      const normName = normalize(name);
      if (normName) {
        const match = byName.get(normName);
        if (match && !matchedIds.has(match.id)) return match;
      }
      return null;
    }

    function buildMergeData(
      existing: (typeof existingGuests)[number],
      incoming: {
        email: string | null; phone: string | null; groupName: string | null;
        tableNumber: number | null; plusOne: boolean; plusOneName: string | null;
        dietaryNotes: string | null; chineseName: string | null; side: string | null;
        relationship: string | null; invitedBy: string | null; category: string | null;
        seatCount: number; isVip: boolean; isElderly: boolean; needsBabyChair: boolean;
        specialNotes: string | null;
      },
    ) {
      const data: Record<string, unknown> = {};

      // Always update: table & group (reassignment is expected)
      data.tableNumber = incoming.tableNumber;
      data.groupName = incoming.groupName;

      // Always update these enriched fields if provided
      if (incoming.chineseName) data.chineseName = incoming.chineseName;
      if (incoming.side) data.side = incoming.side;
      if (incoming.relationship) data.relationship = incoming.relationship;
      if (incoming.invitedBy) data.invitedBy = incoming.invitedBy;
      if (incoming.category) data.category = incoming.category;
      if (incoming.seatCount > 0) data.seatCount = incoming.seatCount;
      if (incoming.isVip) data.isVip = true;
      if (incoming.isElderly) data.isElderly = true;
      if (incoming.needsBabyChair) data.needsBabyChair = true;
      if (incoming.specialNotes) data.specialNotes = incoming.specialNotes;

      // Fill gaps only for contact/dietary fields
      if (!existing.email && incoming.email) data.email = incoming.email;
      if (!existing.phone && incoming.phone) data.phone = incoming.phone;
      if (!existing.plusOneName && incoming.plusOneName) data.plusOneName = incoming.plusOneName;
      if (!existing.dietaryNotes && incoming.dietaryNotes) data.dietaryNotes = incoming.dietaryNotes;
      if (!existing.chineseName && incoming.chineseName) data.chineseName = incoming.chineseName;
      if (incoming.plusOne && !existing.plusOne) data.plusOne = true;

      return data;
    }

    // -----------------------------------------------------------------------
    // 4. Process each row
    // -----------------------------------------------------------------------
    for (let i = 0; i < guestRows.length; i++) {
      const row = guestRows[i];
      const name = str(row.name || row.Name);
      if (!name) {
        results.errors.push({ row: i + 1, name: 'Unknown', error: 'Name is required' });
        results.skipped++;
        continue;
      }

      const email = strOrNull(row.email || row.Email);
      const phone = strOrNull(row.phone || row.Phone);
      const groupName = strOrNull(row.group || row.Group || row.groupName || row.GroupName);
      const chineseName = strOrNull(row.chineseName || row.ChineseName);
      const side = enumOrUndefined(row.side || row.Side, VALID_SIDES);
      const relationship = enumOrUndefined(row.relationship || row.Relationship, VALID_RELATIONSHIPS);
      const invitedBy = strOrNull(row.invitedBy || row.InvitedBy);
      const category = enumOrUndefined(row.category || row.Category, VALID_CATEGORIES);
      const tableNumber = intOrNull(row.tableNumber || row.TableNumber);
      const plusOne = bool(row.plusOne || row.PlusOne);
      const plusOneName = strOrNull(row.plusOneName || row.PlusOneName);
      const seatCount = intOrNull(row.seatCount || row.SeatCount) || 1;
      const dietaryNotes = strOrNull(row.dietaryNotes || row.DietaryNotes || row.dietary || row.Dietary);
      const rsvpStatus = enumOrUndefined(row.rsvpStatus || row.RsvpStatus,
        new Set(['PENDING', 'ATTENDING', 'DECLINED', 'PARTIAL']));
      const isVip = bool(row.isVip || row.IsVip);
      const isElderly = bool(row.isElderly || row.IsElderly);
      const needsBabyChair = bool(row.needsBabyChair || row.NeedsBabyChair);
      const specialNotes = strOrNull(row.specialNotes || row.SpecialNotes);

      try {
        const existing = findExisting(email, phone, name);

        if (existing) {
          const mergeData = buildMergeData(existing, {
            email, phone, groupName, tableNumber, plusOne, plusOneName,
            dietaryNotes, chineseName, side, relationship, invitedBy,
            category, seatCount, isVip, isElderly, needsBabyChair, specialNotes,
          });

          const hasChanges = Object.keys(mergeData).some(
            (key) => JSON.stringify(mergeData[key]) !== JSON.stringify((existing as Record<string, unknown>)[key]),
          );

          if (hasChanges) {
            await db.guest.update({ where: { id: existing.id }, data: mergeData });
          }
          results.updated++;
          matchedIds.add(existing.id);
        } else {
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
              plusOne,
              plusOneName,
              seatCount,
              dietaryNotes,
              rsvpStatus: rsvpStatus ?? 'PENDING',
              isVip,
              isElderly,
              needsBabyChair,
              specialNotes,
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
    // 5. Audit log
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
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
