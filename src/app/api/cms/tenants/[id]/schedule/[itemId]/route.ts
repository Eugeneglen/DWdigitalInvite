import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// PATCH — Update a schedule item
// ============================================

const updateScheduleSchema = z.object({
  eventType: z.string().optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
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

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:schedule:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit the schedule.' }, { status: 403 });
    }

    const existing = await db.eventSchedule.findFirst({
      where: { id: itemId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'Schedule item not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const updated = await db.eventSchedule.update({
      where: { id: itemId },
      data: parsed.data,
    });

    await createAuditLog({
      userId: user.userId,
      action: 'schedule.update',
      resource: 'EventSchedule',
      resourceId: itemId,
      weddingId,
      details: {
        before: { title: existing.title, startTime: existing.startTime, sortOrder: existing.sortOrder },
        after: { title: updated.title, startTime: updated.startTime, sortOrder: updated.sortOrder },
      },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        weddingId: updated.weddingId,
        eventType: updated.eventType,
        startTime: updated.startTime,
        endTime: updated.endTime,
        title: updated.title,
        description: updated.description,
        location: updated.location,
        sortOrder: updated.sortOrder,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update schedule item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Delete a schedule item
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

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:schedule:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit the schedule.' }, { status: 403 });
    }

    const existing = await db.eventSchedule.findFirst({
      where: { id: itemId, weddingId },
    });
    if (!existing) {
      return Response.json({ success: false, error: 'Schedule item not found' }, { status: 404 });
    }

    await db.eventSchedule.delete({ where: { id: itemId } });

    await createAuditLog({
      userId: user.userId,
      action: 'schedule.delete',
      resource: 'EventSchedule',
      resourceId: itemId,
      weddingId,
      details: { title: existing.title, startTime: existing.startTime },
      request,
    });

    return Response.json({ success: true, data: { id: itemId } });
  } catch (err) {
    console.error('Delete schedule item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}