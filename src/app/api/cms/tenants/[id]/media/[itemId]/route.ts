import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// PATCH — Update a media item
// ============================================

const updateMediaSchema = z.object({
  url: z.string().min(1).optional(),
  thumbnailUrl: z.string().nullable().optional(),
  fileName: z.string().min(1).optional(),
  fileType: z.string().optional(),
  fileSize: z.number().int().nullable().optional(),
  category: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
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

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:media:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to manage media.' }, { status: 403 });
    }

    const existing = await db.weddingMedia.findFirst({
      where: { id: itemId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'Media item not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateMediaSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await db.weddingMedia.update({
      where: { id: itemId },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user.userId,
      action: 'media.update',
      resource: 'WeddingMedia',
      resourceId: itemId,
      weddingId,
      details: {
        before: { category: existing.category, fileName: existing.fileName, sortOrder: existing.sortOrder },
        after: { category: updated.category, fileName: updated.fileName, sortOrder: updated.sortOrder },
      },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        weddingId: updated.weddingId,
        category: updated.category,
        url: updated.url,
        thumbnailUrl: updated.thumbnailUrl,
        fileName: updated.fileName,
        fileType: updated.fileType,
        fileSize: updated.fileSize,
        sortOrder: updated.sortOrder,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update media item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Delete a media item
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

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:media:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to manage media.' }, { status: 403 });
    }

    const existing = await db.weddingMedia.findFirst({
      where: { id: itemId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'Media item not found' }, { status: 404 });
    }

    await db.weddingMedia.delete({ where: { id: itemId } });

    await createAuditLog({
      userId: user.userId,
      action: 'media.delete',
      resource: 'WeddingMedia',
      resourceId: itemId,
      weddingId,
      details: { category: existing.category, fileName: existing.fileName },
      request,
    });

    return Response.json({ success: true, data: { id: itemId } });
  } catch (err) {
    console.error('Delete media item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}