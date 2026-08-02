import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import crypto from 'crypto';

// POST /api/cms/guests/bulk — bulk import guests from CSV data
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

    // Collect all existing invitation codes to avoid duplicates
    const existingCodes = await db.guest.findMany({
      where: { weddingId: wedding.id },
      select: { invitationCode: true },
    });
    const existingCodeSet = new Set(existingCodes.map((g) => g.invitationCode));

    function generateCode(): string {
      let code: string;
      do {
        code = crypto.randomBytes(3).toString('hex').toUpperCase();
      } while (existingCodeSet.has(code));
      existingCodeSet.add(code);
      return code;
    }

    const results = { created: 0, skipped: 0, errors: [] as Array<{ row: number; name: string; error: string }> };

    for (let i = 0; i < guestRows.length; i++) {
      const row = guestRows[i];
      const name = (row.name || row.Name || '').trim();
      if (!name) {
        results.errors.push({ row: i + 1, name: 'Unknown', error: 'Name is required' });
        results.skipped++;
        continue;
      }

      try {
        await db.guest.create({
          data: {
            weddingId: wedding.id,
            name,
            email: (row.email || row.Email || '').trim() || null,
            phone: (row.phone || row.Phone || '').trim() || null,
            groupName: (row.group || row.Group || row.groupName || row.GroupName || '').trim() || null,
            tableNumber: row.tableNumber || row.TableNumber ? parseInt(String(row.tableNumber || row.TableNumber), 10) || null : null,
            plusOne: row.plusOne === 'true' || row.PlusOne === 'true' || row.plus_one === 'yes' || row.plus_one === '1' || row.plusOne === true,
            plusOneName: (row.plusOneName || row.PlusOneName || row.plus_one_name || '').trim() || null,
            dietaryNotes: (row.dietaryNotes || row.DietaryNotes || row.dietary || row.Dietary || '').trim() || null,
            rsvpStatus: (row.rsvpStatus as string) || null,
            invitationCode: generateCode(),
          },
        });
        results.created++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create guest';
        results.errors.push({ row: i + 1, name, error: msg });
        results.skipped++;
      }
    }

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        weddingId: wedding.id,
        action: 'CREATE',
        entity: 'Guest',
        details: JSON.stringify({ type: 'bulk_import', created: results.created, skipped: results.skipped, errors: results.errors.length }),
      },
    });

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('Bulk guest import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}