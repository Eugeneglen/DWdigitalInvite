import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — List all schedule items for a wedding
// ============================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:read');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have access to this wedding.' }, { status: 403 });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const items = await db.eventSchedule.findMany({
      where: { weddingId },
      orderBy: { sortOrder: 'asc' },
    });

    return Response.json({
      success: true,
      data: items.map((item) => ({
        id: item.id,
        weddingId: item.weddingId,
        eventType: item.eventType,
        startTime: item.startTime,
        endTime: item.endTime,
        title: item.title,
        description: item.description,
        location: item.location,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List schedule items error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Create a new schedule item
// ============================================

const createScheduleSchema = z.object({
  eventType: z.string().default('CUSTOM'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:schedule:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit the schedule.' }, { status: 403 });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { eventType, startTime, endTime, title, description, location } = parsed.data;

    // Auto-assign sortOrder = max existing sortOrder + 1
    const maxSortOrder = await db.eventSchedule.findFirst({
      where: { weddingId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const sortOrder = (maxSortOrder?.sortOrder ?? -1) + 1;

    const item = await db.eventSchedule.create({
      data: {
        weddingId,
        eventType,
        startTime,
        endTime: endTime ?? null,
        title,
        description: description ?? null,
        location: location ?? null,
        sortOrder,
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: 'schedule.create',
      resource: 'EventSchedule',
      resourceId: item.id,
      weddingId,
      details: { eventType, title, startTime, sortOrder },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: item.id,
        weddingId: item.weddingId,
        eventType: item.eventType,
        startTime: item.startTime,
        endTime: item.endTime,
        title: item.title,
        description: item.description,
        location: item.location,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Create schedule item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}