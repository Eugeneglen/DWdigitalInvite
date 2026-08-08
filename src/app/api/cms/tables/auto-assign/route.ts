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

const GROUP_ZONE_MAP: Record<string, string> = {
  "bride's family": 'BRIDE_FAMILY',
  "bride family": 'BRIDE_FAMILY',
  "bride's side": 'BRIDE_FAMILY',
  "bride side": 'BRIDE_FAMILY',
  "groom's family": 'GROOM_FAMILY',
  "groom family": 'GROOM_FAMILY',
  "groom's side": 'GROOM_FAMILY',
  "groom side": 'GROOM_FAMILY',
  friends: 'FRIENDS',
  "friend group": 'FRIENDS',
  colleagues: 'COLLEAGUES',
  "work": 'COLLEAGUES',
  "office": 'COLLEAGUES',
  vip: 'VIP',
};

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
    const strategies: Strategies = body.strategies ?? {
      groupTogether: true,
      pairPlusOnes: true,
      matchZones: false,
      balanceFill: true,
    };
    const clearExisting: boolean = body.clearExisting ?? false;

    // If clearExisting, unassign all guests first
    if (clearExisting) {
      await db.guest.updateMany({
        where: { weddingId: wedding.id, tableNumber: { not: null } },
        data: { tableNumber: null },
      });
    }

    // Get all guests and tables
    const allGuests = await db.guest.findMany({
      where: { weddingId: wedding.id },
      select: { id: true, name: true, groupName: true, tableNumber: true, rsvpStatus: true, plusOne: true, plusOneName: true },
    });

    const allTables = await db.seatingTable.findMany({
      where: { weddingId: wedding.id },
      select: { id: true, tableNum: true, zone: true, capacity: true },
    });

    // Get unassigned guests (exclude declined)
    const unassigned = allGuests.filter(
      g => g.tableNumber === null && g.rsvpStatus?.toUpperCase() !== 'DECLINED'
    );

    if (unassigned.length === 0 || allTables.length === 0) {
      return NextResponse.json({ assigned: 0, unassigned: 0, tablesUsed: 0 });
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

    const assignGuest = (guestId: string, tableNum: number) => {
      tableOccupancy.set(tableNum, (tableOccupancy.get(tableNum) || 0) + 1);
      return db.guest.update({
        where: { id: guestId },
        data: { tableNumber },
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

    // Sort tables for preference
    const getZoneHint = (groupName: string): string | null => {
      const lower = groupName.toLowerCase().trim();
      return GROUP_ZONE_MAP[lower] || null;
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

    // Plus-one pairing: find pairs
    const pairedGuests = new Set<string>();
    if (strategies.pairPlusOnes) {
      for (const guest of unassigned) {
        if (pairedGuests.has(guest.id)) continue;
        if (!guest.plusOne || !guest.plusOneName) continue;

        // Find the plus-one partner among unassigned guests
        const partner = unassigned.find(
          g => g.id !== guest.id && !pairedGuests.has(g.id) &&
               g.name.toLowerCase().trim() === guest.plusOneName.toLowerCase().trim()
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
            await assignGuest(guest.id, targetTable.tableNum);
            await assignGuest(partner.id, targetTable.tableNum);
            pairedGuests.add(guest.id);
            pairedGuests.add(partner.id);
            usedTableNums.add(targetTable.tableNum);
            assigned += 2;
          }
        }
      }
    }

    // Group-aware assignment
    if (strategies.groupTogether) {
      for (const [group, guests] of groupMap) {
        const remaining = guests.filter(g => !pairedGuests.has(g.id));
        if (remaining.length === 0) continue;

        const zoneHint = getZoneHint(group);

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

        if (tableBigEnough.length > 0) {
          const target = tablesBigEnough[0];
          for (const g of remaining) {
            await assignGuest(g.id, target.tableNum);
            assigned++;
            usedTableNums.add(target.tableNum);
          }
        } else {
          // Split across fewest tables
          let toPlace = [...remaining];
          while (toPlace.length > 0) {
            const table = findBestTable(zoneHint);
            if (!table) break;
            const room = getTableRoom(table.tableNum);
            const batch = toPlace.slice(0, room);
            for (const g of batch) {
              await assignGuest(g.id, table.tableNum);
              assigned++;
              usedTableNums.add(table.tableNum);
            }
            toPlace = toPlace.slice(room);
          }
        }
      }
    } else {
      // Simple assignment for remaining unpaired guests
      const remaining = unassigned.filter(g => !pairedGuests.has(g.id));
      for (const g of remaining) {
        const table = findBestTable(g.groupName ? getZoneHint(g.groupName) : null);
        if (!table) break;
        await assignGuest(g.id, table.tableNum);
        assigned++;
        usedTableNums.add(table.tableNum);
      }
    }

    const stillUnassigned = unassigned.length - assigned;

    return NextResponse.json({
      assigned,
      unassigned: Math.max(0, stillUnassigned),
      tablesUsed: usedTableNums.size,
    });
  } catch (error) {
    console.error('Smart auto-assign error:', error);
    const message = error instanceof Error ? error.message : 'Auto-assign failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
