import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const wishSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  relationship: z.string().optional(),
  message: z.string().min(1, 'Message is required'),
  weddingId: z.string().optional(),
  imageUrl: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // Rate limit: 5 wishes per minute per IP
    const ip = getClientIp(request);
    const { success, remaining, resetAt } = rateLimit(`wish:${ip}`, 5, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many wishes. Please wait a moment.', retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = wishSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, relationship, message, weddingId, imageUrl } = parsed.data;

    // Validate weddingId if provided
    if (weddingId) {
      const wedding = await db.weddingAccount.findUnique({
        where: { id: weddingId },
        select: { id: true, status: true },
      });
      if (!wedding) {
        return NextResponse.json({ error: 'Wedding not found' }, { status: 404 });
      }
    }

    const wish = await db.wish.create({
      data: {
        name,
        relationship: relationship || null,
        message,
        weddingId: weddingId || null,
        imageUrl: imageUrl || null,
      },
    });

    // Notify wedding owner about new wish
    if (weddingId) {
      const { notifyWeddingOwner } = await import('@/lib/notifications');
      await notifyWeddingOwner(
        weddingId,
        'WISH_RECEIVED',
        'New Wish Received',
        `${name}${relationship ? ` (${relationship})` : ''} left a wish: "${message.slice(0, 80)}${message.length > 80 ? '…' : ''}"`,
        'wishes',
      );
    }

    // Notify WebSocket service about new wish
    try {
      await fetch(`http://localhost:3004/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_wish',
          payload: { id: wish.id, name: wish.name, relationship: wish.relationship, message: wish.message, imageUrl: wish.imageUrl, createdAt: wish.createdAt, weddingId: wish.weddingId },
        }),
      }).catch(() => {
        // WebSocket service may not be running — ignore
      });
    } catch {
      // Ignore WebSocket notification failure
    }

    return NextResponse.json({ success: true, id: wish.id, wish });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const weddingId = searchParams.get('weddingId');

    // Require weddingId — don't allow dumping all wishes across weddings
    if (!weddingId) {
      return NextResponse.json({ error: 'weddingId is required' }, { status: 400 });
    }

    const wishes = await db.wish.findMany({
      where: { weddingId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ wishes });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}