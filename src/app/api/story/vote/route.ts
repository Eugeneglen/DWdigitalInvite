import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const voteSchema = z.object({
  destination: z.string().min(1, 'Destination is required'),
  voterName: z.string().min(1, 'Your name is required'),
  weddingSlug: z.string().min(1, 'Wedding slug is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { destination, voterName, weddingSlug } = parsed.data;

    const wedding = await db.weddingAccount.findUnique({
      where: { slug: weddingSlug },
    });

    if (!wedding) {
      return NextResponse.json(
        { error: 'Wedding not found' },
        { status: 404 }
      );
    }

    const existing = await db.honeymoonVote.findFirst({
      where: { weddingId: wedding.id, destination, voterName },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'You have already voted for this destination' },
        { status: 409 }
      );
    }

    await db.honeymoonVote.create({
      data: { weddingId: wedding.id, destination, voterName },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
