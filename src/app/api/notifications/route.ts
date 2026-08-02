import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { normalizePlatformRole } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// GET /api/notifications — list notifications for the current user
// Query params: ?unreadOnly=true&limit=50
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 100);
    const role = session.user.role;

    // Build the where clause — couples see wedding-linked notifications too
    let weddingIds: string[] = [];
    if (normalizePlatformRole(role) === 'COUPLE') {
      const weddings = await db.weddingAccount.findMany({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      weddingIds = weddings.map((w) => w.id);
    }

    const where = normalizePlatformRole(role) === 'COUPLE'
      ? {
          OR: [
            { userId: session.user.id },
            ...(weddingIds.length > 0 ? [{ weddingId: { in: weddingIds } }] : []),
          ],
          ...(unreadOnly ? { isRead: false } : {}),
        }
      : {
          userId: session.user.id,
          ...(unreadOnly ? { isRead: false } : {}),
        };

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.notification.count({
        where: normalizePlatformRole(role) === 'COUPLE'
          ? {
              OR: [
                { userId: session.user.id },
                ...(weddingIds.length > 0 ? [{ weddingId: { in: weddingIds } }] : []),
              ],
              isRead: false,
            }
          : { userId: session.user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/notifications — mark as read or mark all as read
// Body: { id?: string, markAll?: boolean }
// ---------------------------------------------------------------------------

export async function PUT(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, markAll } = body as { id?: string; markAll?: boolean };
    const role = session.user.role;

    // Build base where for user/wedding scoping
    let baseWhere: Record<string, unknown> = {};
    if (normalizePlatformRole(role) === 'COUPLE') {
      const weddings = await db.weddingAccount.findMany({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      const weddingIds = weddings.map((w) => w.id);
      baseWhere = weddingIds.length > 0
        ? { OR: [{ userId: session.user.id }, { weddingId: { in: weddingIds } }] }
        : { userId: session.user.id };
    } else {
      baseWhere = { userId: session.user.id };
    }

    if (markAll) {
      const result = await db.notification.updateMany({
        where: { ...baseWhere, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, updated: result.count });
    }

    if (id) {
      // Verify ownership before marking
      const notification = await db.notification.findFirst({
        where: { id, ...baseWhere },
      });
      if (!notification) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      await db.notification.update({
        where: { id },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Provide id or markAll' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/notifications — clear all or delete one
// Query params: ?id=xxx or ?clearAll=true
// ---------------------------------------------------------------------------

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';
    const role = session.user.role;

    let baseWhere: Record<string, unknown> = {};
    if (normalizePlatformRole(role) === 'COUPLE') {
      const weddings = await db.weddingAccount.findMany({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      const weddingIds = weddings.map((w) => w.id);
      baseWhere = weddingIds.length > 0
        ? { OR: [{ userId: session.user.id }, { weddingId: { in: weddingIds } }] }
        : { userId: session.user.id };
    } else {
      baseWhere = { userId: session.user.id };
    }

    if (clearAll) {
      const result = await db.notification.deleteMany({ where: baseWhere });
      return NextResponse.json({ success: true, deleted: result.count });
    }

    if (id) {
      const notification = await db.notification.findFirst({
        where: { id, ...baseWhere },
      });
      if (!notification) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      await db.notification.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Provide id or clearAll' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}