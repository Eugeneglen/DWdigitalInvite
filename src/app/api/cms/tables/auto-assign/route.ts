import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface Strategies {
  groupTogether: boolean;
  pairPlusOnes: boolean;
  matchZones: boolean;
  balanceFill: boolean;
}

// Fix 3: Expanded zone keyword map — each zone has an array of keyword phrases
const ZONE_KEYWORDS: Record<string, string[]> = {
  BRIDE_FAMILY: [
    "bride's family", 'bride family', "bride's side", 'bride side',
    'bride parents', 'bride parent', 'bride relative', 'bride relatives',
    'bride grandmother', 'bride grandfather', 'bride grandparents',
    'bride sibling', 'bride siblings', 'bride brother', 'bride sister',
    'bride cousin', 'bride cousins', 'bride aunt', 'bride uncle',
    "bride's mom", "bride's dad", "bride's mother", "bride's father",
  ],
  GROOM_FAMILY: [
    "groom's family", 'groom family', "groom's side", 'groom side',
    'groom parents', 'groom parent', 'groom relative', 'groom relatives',
    'groom grandmother', 'groom grandfather', 'groom grandparents',
    'groom sibling', 'groom siblings', 'groom brother', 'groom sister',
    'groom cousin', 'groom cousins', 'groom aunt', 'groom uncle',
    "groom's mom", "groom's dad", "groom's mother", "groom's father",
  ],
  FRIENDS: [
    'friends', 'friend group', 'friend', 'school friends',
    'college friends', 'university friends', 'childhood friends',
    'best friends', 'close friends',
  ],
  COLLEAGUES: [
    'colleagues', 'colleague', 'work', 'office', 'coworkers',
    'coworker', 'work friends', 'work friend', 'workmates',
    'teammates', 'team', 'work group',
  ],
  VIP: [
    'vip', 'vip table', 'head table', 'dignitaries', 'honored guests',
    'special guests', 'VIP', 'VIP table', 'head',
  ],
};

// Fix 6: In-memory mutex set to prevent concurrent auto-assign for the same wedding
const activeAssignments = new Set<string>();

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

    // Fix 6: Mutex check — prevent double-click race conditions
    if (activeAssignments.has(wedding.id)) {
      return NextResponse.json(
        { error: 'Auto-assign already in progress. Please wait.' },
        { status: 429 },
      );
    }
    activeAssignments.add(wedding.id);

    try {
      const body = await req.json();
      const strategies: Strategies = body.strategies ?? {
        groupTogether: true,
        pairPlusOnes: true,
        matchZones: false,
        balanceFill: true,
      };
      const clearExisting: boolean = body.clearExisting ?? false;
      // Fix 5: dry-run mode
      const dryRun: boolean = body.dryRun ?? false;

      // If clearExisting, unassign all guests first (skip in dry-run)
      if (clearExisting && !dryRun) {
        await db.guest.updateMany({
          where: { weddingId: wedding.id, tableNumber: { not: null } },
          data: { tableNumber: null },
        });
      }

      // Get all guests and tables
      const allGuests = await db.guest.findMany({
        where: { weddingId: wedding.id },
        select: {
          id: true, name: true, groupName: true,
          tableNumber: true, rsvpStatus: true, plusOne: true, plusOneName: true,
        },
      });

      const allTables = await db.seatingTable.findMany({
        where: { weddingId: wedding.id },
        select: { id: true, tableNum: true, zone: true, capacity: true },
      });

      // Get unassigned guests (exclude declined)
      const unassigned = allGuests.filter(
        g => g.tableNumber === null && g.rsvpStatus?.toUpperCase() !== 'DECLINED',
      );

      if (unassigned.length === 0 || allTables.length === 0) {
        const result = { assigned: 0, unassigned: 0, tablesUsed: 0 };
        return NextResponse.json(dryRun ? { ...result, dryRun: true, plan: [] } : result);
      }

      // Build table occupancy map
      const tableOccupancy = new Map<number, number>();
      allGuests.forEach(g => {
        if (g.tableNumber != null) {
          tableOccupancy.set(g.tableNumber, (tableOccupancy.get(g.tableNumber) || 0) + 1);
        }
      });

      const getTableRoom = (tableNum: number) => {
        const tbl = allTables.find(t => t.tableNum === tableNum);
        if (!tbl) return 0;
        return tbl.capacity - (tableOccupancy.get(tableNum) || 0);
      };

      // Fix 5: Dry-run plan accumulator
      const plan: { guestId: string; guestName: string; tableNum: number }[] = [];

      const assignGuest = (guestId: string, guestName: string, tableNum: number) => {
        tableOccupancy.set(tableNum, (tableOccupancy.get(tableNum) || 0) + 1);
        if (dryRun) {
          plan.push({ guestId, guestName, tableNum });
          return Promise.resolve();
        }
        return db.guest.update({
          where: { id: guestId },
          data: { tableNumber: tableNum },
        });
      };

      let assigned = 0;
      const usedTableNums = new Set<number>();

      // Build group -> guests map
      const groupMap = new Map<string, typeof unassigned>();
      unassigned.forEach(g => {
        const group = (g.groupName || '').trim().toLowerCase() || '__ungrouped__';
        if (!groupMap.has(group)) groupMap.set(group, []);
        groupMap.get(group)!.push(g);
      });

      // Fix 3: Partial/keyword matching for zone hints
      const getZoneHint = (groupName: string): string | null => {
        const lower = groupName.toLowerCase().trim();
        // Split group name into individual words for partial matching
        const words = lower.split(/\s+/);
        for (const [zone, keywords] of Object.entries(ZONE_KEYWORDS)) {
          for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            // Check if any word in the group name appears in any keyword phrase,
            // or if any keyword phrase is a substring of the group name
            if (lower.includes(kwLower)) {
              return zone;
            }
            // Also check if any single word from the group name appears in the keyword
            for (const w of words) {
              if (w.length >= 3 && kwLower.includes(w)) {
                return zone;
              }
            }
          }
        }
        return null;
      };

      const findBestTable = (groupHint?: string | null) => {
        const sortedTables = [...allTables].sort((a, b) => {
          // If matchZones, prefer tables with matching zone
          if (strategies.matchZones && groupHint) {
            const aMatch = a.zone === groupHint ? 0 : 1;
            const bMatch = b.zone === groupHint ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
          }
          // If balanceFill, prefer less filled tables
          if (strategies.balanceFill) {
            const aFill = (tableOccupancy.get(a.tableNum) || 0) / a.capacity;
            const bFill = (tableOccupancy.get(b.tableNum) || 0) / b.capacity;
            return aFill - bFill;
          }
          return 0;
        });
        return sortedTables.find(t => getTableRoom(t.tableNum) > 0) || null;
      };

      // Plus-one pairing: find pairs (Fix 1: fuzzy matching)
      const pairedGuests = new Set<string>();
      if (strategies.pairPlusOnes) {
        for (const guest of unassigned) {
          if (pairedGuests.has(guest.id)) continue;
          if (!guest.plusOne || !guest.plusOneName) continue;

          // Fix 1: Fuzzy plus-one matching using includes() (case-insensitive, trimmed)
          const poName = guest.plusOneName.toLowerCase().trim();
          const partner = unassigned.find(
            g => g.id !== guest.id && !pairedGuests.has(g.id) &&
              (
                g.name.toLowerCase().trim().includes(poName) ||
                poName.includes(g.name.toLowerCase().trim())
              ),
          );

          if (partner) {
            // Find a table with room for both
            const tablesWithRoom = allTables
              .filter(t => getTableRoom(t.tableNum) >= 2)
              .sort((a, b) => {
                if (strategies.balanceFill) {
                  const aFill = (tableOccupancy.get(a.tableNum) || 0) / a.capacity;
                  const bFill = (tableOccupancy.get(b.tableNum) || 0) / b.capacity;
                  return aFill - bFill;
                }
                return 0;
              });

            const targetTable = tablesWithRoom[0] || findBestTable();
            if (targetTable) {
              await assignGuest(guest.id, guest.name, targetTable.tableNum);
              await assignGuest(partner.id, partner.name, targetTable.tableNum);
              pairedGuests.add(guest.id);
              pairedGuests.add(partner.id);
              usedTableNums.add(targetTable.tableNum);
              assigned += 2;
            }
          }
        }
      }

      // Fix 2: Sort groups by size descending (stable sort — same-size groups keep original order)
      const sortedGroupEntries = [...groupMap.entries()].sort(
        (a, b) => b[1].length - a[1].length,
      );

      // Group-aware assignment
      if (strategies.groupTogether) {
        for (const [group, guests] of sortedGroupEntries) {
          const remaining = guests.filter(g => !pairedGuests.has(g.id));
          if (remaining.length === 0) continue;

          const zoneHint = getZoneHint(group);

          // Fix 4: Skip "fit whole group" for __ungrouped__, go directly to individual assignment
          const isUngrouped = group === '__ungrouped__';

          if (!isUngrouped) {
            // Try to fit the whole group at one table
            const tablesBigEnough = allTables
              .filter(t => getTableRoom(t.tableNum) >= remaining.length)
              .sort((a, b) => {
                if (strategies.matchZones && zoneHint) {
                  const aMatch = a.zone === zoneHint ? 0 : 1;
                  const bMatch = b.zone === zoneHint ? 0 : 1;
                  if (aMatch !== bMatch) return aMatch - bMatch;
                }
                return (tableOccupancy.get(a.tableNum) || 0) - (tableOccupancy.get(b.tableNum) || 0);
              });

            if (tablesBigEnough.length > 0) {
              const target = tablesBigEnough[0];
              for (const g of remaining) {
                await assignGuest(g.id, g.name, target.tableNum);
                assigned++;
                usedTableNums.add(target.tableNum);
              }
              continue; // Group fully placed, move to next group
            }
          }

          // Split across fewest tables (or individual assignment for ungrouped)
          let toPlace = [...remaining];
          while (toPlace.length > 0) {
            const table = findBestTable(zoneHint);
            if (!table) break;
            const room = getTableRoom(table.tableNum);
            const batch = toPlace.slice(0, room);
            for (const g of batch) {
              await assignGuest(g.id, g.name, table.tableNum);
              assigned++;
              usedTableNums.add(table.tableNum);
            }
            toPlace = toPlace.slice(room);
          }
        }
      } else {
        // Simple assignment for remaining unpaired guests
        const remaining = unassigned.filter(g => !pairedGuests.has(g.id));
        for (const g of remaining) {
          const table = findBestTable(g.groupName ? getZoneHint(g.groupName) : null);
          if (!table) break;
          await assignGuest(g.id, g.name, table.tableNum);
          assigned++;
          usedTableNums.add(table.tableNum);
        }
      }

      const stillUnassigned = unassigned.length - assigned;

      if (dryRun) {
        return NextResponse.json({
          assigned,
          unassigned: Math.max(0, stillUnassigned),
          tablesUsed: usedTableNums.size,
          dryRun: true,
          plan,
        });
      }

      return NextResponse.json({
        assigned,
        unassigned: Math.max(0, stillUnassigned),
        tablesUsed: usedTableNums.size,
      });
    } finally {
      // Fix 6: Always release the lock
      activeAssignments.delete(wedding.id);
    }
  } catch (error) {
    console.error('Smart auto-assign error:', error);
    const message = error instanceof Error ? error.message : 'Auto-assign failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
