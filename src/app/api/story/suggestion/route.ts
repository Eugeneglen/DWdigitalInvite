import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const suggestionSchema = z.object({
  name: z.string().min(1, 'Suggestion is required'),
  suggestedBy: z.string().min(1, 'Your name is required'),
  weddingSlug: z.string().min(1, 'Wedding slug is required'),
});

export async function POST(request: Request) {
  try {
    // Rate limit: 5 suggestions per minute per IP
    const ip = getClientIp(request);
    const { success, resetAt } = rateLimit(`suggestion:${ip}`, 5, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many suggestions. Please wait a moment.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = suggestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, suggestedBy, weddingSlug } = parsed.data;

    const wedding = await db.weddingAccount.findUnique({
      where: { slug: weddingSlug },
    });

    if (!wedding) {
      return NextResponse.json(
        { error: 'Wedding not found' },
        { status: 404 }
      );
    }

    const suggestion = await db.honeymoonSuggestion.create({
      data: { weddingId: wedding.id, name, suggestedBy },
    });

    return NextResponse.json({ success: true, id: suggestion.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
