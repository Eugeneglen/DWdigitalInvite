import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// PATCH — Update a wish (message, name, etc.)
// Note: Wish model has no status field; moderation is not supported.
// ============================================

const updateWishSchema = z.object({
  name: z.string().min(1).optional(),
  relationship: z.string().nullable().optional(),
  message: z.string().min(1).optional(),
  imageUrl: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; wishId: string }> }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (authError || !user) {
      return Response.json({ success: false, error: authError || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, wishId } = await params;
    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:wishes:moderate');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to moderate wishes.' }, { status: 403 });
    }

    const existing = await db.wish.findFirst({
      where: { id: wishId, weddingId },
    });

    if (!existing) {
      return Response.json({ success: false, error: 'Wish not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateWishSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await db.wish.update({
      where: { id: wishId },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user.userId,
      action: 'wish.update',
      resource: 'Wish',
      resourceId: wishId,
      weddingId,
      details: {
        before: { name: existing.name, message: existing.message },
        after: { name: updated.name, message: updated.message },
      },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        weddingId: updated.weddingId,
        name: updated.name,
        relationship: updated.relationship,
        message: updated.message,
        imageUrl: updated.imageUrl,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update wish error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Remove a wish
// ============================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; wishId: string }> }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (authError || !user) {
      return Response.json({ success: false, error: authError || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, wishId } = await params;
    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:wishes:moderate');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to moderate wishes.' }, { status: 403 });
    }

    const existing = await db.wish.findFirst({
      where: { id: wishId, weddingId },
    });

    if (!existing) {
      return Response.json({ success: false, error: 'Wish not found' }, { status: 404 });
    }

    await db.wish.delete({ where: { id: wishId } });

    await createAuditLog({
      userId: user.userId,
      action: 'wish.delete',
      resource: 'Wish',
      resourceId: wishId,
      weddingId,
      details: { name: existing.name },
      request,
    });

    return Response.json({ success: true, data: { id: wishId } });
  } catch (err) {
    console.error('Delete wish error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}