import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// PATCH — Update a FAQ item
// ============================================

const updateFaqSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, itemId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:content:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit content.' }, { status: 403 });
    }

    const existing = await db.fAQ.findFirst({
      where: { id: itemId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'FAQ item not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateFaqSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await db.fAQ.update({
      where: { id: itemId },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user.userId,
      action: 'faq.update',
      resource: 'FAQ',
      resourceId: itemId,
      weddingId,
      details: {
        before: { question: existing.question, sortOrder: existing.sortOrder, isActive: existing.isActive },
        after: { question: updated.question, sortOrder: updated.sortOrder, isActive: updated.isActive },
      },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        weddingId: updated.weddingId,
        question: updated.question,
        answer: updated.answer,
        sortOrder: updated.sortOrder,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update FAQ item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Delete a FAQ item
// ============================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, itemId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:content:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit content.' }, { status: 403 });
    }

    const existing = await db.fAQ.findFirst({
      where: { id: itemId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'FAQ item not found' }, { status: 404 });
    }

    await db.fAQ.delete({ where: { id: itemId } });

    await createAuditLog({
      userId: user.userId,
      action: 'faq.delete',
      resource: 'FAQ',
      resourceId: itemId,
      weddingId,
      details: { question: existing.question },
      request,
    });

    return Response.json({ success: true, data: { id: itemId } });
  } catch (err) {
    console.error('Delete FAQ item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}