import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weddingId = await getWeddingId(session.user.id);
    if (!weddingId) {
      return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    }

    // 1. Total votes & unique voters
    const totalVotes = await db.honeymoonVote.count({ where: { weddingId } });

    const uniqueVotersResult = await db.honeymoonVote.groupBy({
      by: ['voterName'],
      where: { weddingId },
    });
    const uniqueVoters = uniqueVotersResult.length;

    // 2. Vote ranking by destination
    const voteGroups = await db.honeymoonVote.groupBy({
      by: ['destination'],
      where: { weddingId },
      _count: { destination: true },
      orderBy: { _count: { destination: 'desc' } },
    });

    const ranking = voteGroups.map((g, i) => ({
      rank: i + 1,
      destination: g.destination,
      votes: g._count.destination,
      percentage: totalVotes > 0 ? Math.round((g._count.destination / totalVotes) * 100) : 0,
    }));

    // 3. Chart data (for recharts)
    const chartData = voteGroups.map((g) => ({
      name: g.destination,
      value: g._count.destination,
    }));

    // 4. Top 5 suggestions grouped by name (case-insensitive)
    const allSuggestions = await db.honeymoonSuggestion.findMany({
      where: { weddingId },
      select: { name: true },
    });

    const suggestionCounts = new Map<string, number>();
    for (const s of allSuggestions) {
      const key = s.name.trim().toLowerCase();
      suggestionCounts.set(key, (suggestionCounts.get(key) ?? 0) + 1);
    }

    const topSuggestions = Array.from(suggestionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
      }));

    return NextResponse.json({
      totalVotes,
      uniqueVoters,
      ranking,
      chartData,
      topSuggestions,
    });
  } catch (error) {
    console.error('[honeymoon-analytics]', error);
    return NextResponse.json(
      { error: 'Failed to load honeymoon analytics' },
      { status: 500 },
    );
  }
}
