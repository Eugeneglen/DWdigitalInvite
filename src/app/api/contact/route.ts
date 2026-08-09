import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  contact: z.string().optional(),
  reason: z.string().min(1, 'Reason for contact is required'),
  weddingId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    // Rate limit: 5 contact submissions per minute per IP
    const ip = getClientIp(request);
    const { success, resetAt } = rateLimit(`contact:${ip}`, 5, 60_000);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many messages. Please wait a moment.', retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)) } }
      );
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, contact, reason, weddingId } = parsed.data;

    // Validate weddingId if provided
    if (weddingId) {
      const wedding = await db.weddingAccount.findUnique({
        where: { id: weddingId },
        select: { id: true },
      });
      if (!wedding) {
        return NextResponse.json({ error: 'Wedding not found' }, { status: 404 });
      }
    }

    const submission = await db.contactSubmission.create({
      data: {
        name,
        email,
        contact: contact || null,
        reason,
        weddingId: weddingId || null,
      },
    });

    // Notify wedding owner about new contact submission
    if (weddingId) {
      const { notifyWeddingOwner } = await import('@/lib/notifications');
      await notifyWeddingOwner(
        weddingId,
        'CONTACT_RECEIVED',
        'New Concierge Message',
        `${name} (${email}) contacted you: "${reason.slice(0, 80)}${reason.length > 80 ? '…' : ''}"`,
        'overview',
      );
    }

    return NextResponse.json({ success: true, id: submission.id });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}