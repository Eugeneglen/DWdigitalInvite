import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// PATCH — Update a content entry
// ============================================

const updateContentSchema = z.object({
  section: z.string().min(1).optional(),
  fieldKey: z.string().min(1).optional(),
  fieldValue: z.string().optional(),
  fieldType: z.enum(['TEXT', 'RICHTEXT', 'IMAGE_URL', 'JSON', 'NUMBER', 'BOOLEAN']).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, blockId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:content:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit content.' }, { status: 403 });
    }

    const existing = await db.weddingContent.findFirst({
      where: { id: blockId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'Content entry not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateContentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await db.weddingContent.update({
      where: { id: blockId },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user.userId,
      action: 'content.update',
      resource: 'WeddingContent',
      resourceId: blockId,
      weddingId,
      details: {
        before: { section: existing.section, fieldKey: existing.fieldKey, fieldType: existing.fieldType },
        after: { section: updated.section, fieldKey: updated.fieldKey, fieldType: updated.fieldType },
      },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        weddingId: updated.weddingId,
        section: updated.section,
        fieldKey: updated.fieldKey,
        fieldValue: updated.fieldValue,
        fieldType: updated.fieldType,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update content block error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Delete a content entry
// ============================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId, blockId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:content:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit content.' }, { status: 403 });
    }

    const existing = await db.weddingContent.findFirst({
      where: { id: blockId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'Content entry not found' }, { status: 404 });
    }

    await db.weddingContent.delete({ where: { id: blockId } });

    await createAuditLog({
      userId: user.userId,
      action: 'content.delete',
      resource: 'WeddingContent',
      resourceId: blockId,
      weddingId,
      details: { section: existing.section, fieldKey: existing.fieldKey },
      request,
    });

    return Response.json({ success: true, data: { id: blockId } });
  } catch (err) {
    console.error('Delete content block error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}