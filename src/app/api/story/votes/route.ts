import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const weddingSlug = searchParams.get('weddingSlug');

    if (!weddingSlug) {
      return NextResponse.json(
        { error: 'weddingSlug query parameter is required' },
        { status: 400 }
      );
    }

    const wedding = await db.weddingAccount.findUnique({
      where: { slug: weddingSlug },
    });

    if (!wedding) {
      return NextResponse.json(
        { error: 'Wedding not found' },
        { status: 404 }
      );
    }

    const voteCounts = await db.honeymoonVote.groupBy({
      by: ['destination'],
      where: { weddingId: wedding.id },
      _count: { destination: true },
      orderBy: { _count: { destination: 'desc' } },
    });

    const destinations = voteCounts.map((v) => ({
      name: v.destination,
      votes: v._count.destination,
    }));

    const suggestions = await db.honeymoonSuggestion.findMany({
      where: { weddingId: wedding.id },
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        suggestedBy: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ destinations, suggestions });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
