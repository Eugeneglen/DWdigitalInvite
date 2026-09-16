import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, authorizeTenantAccess } from '@/lib/auth-middleware';

// ============================================
// GET — List wishes for a wedding (paginated, filterable, with stats)
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (authError || !user) {
      return Response.json({ success: false, error: authError || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;
    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:read' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '12')));
    const search = searchParams.get('search') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';

    // Build where clause
    const where: Record<string, unknown> = { weddingId };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { message: { contains: search } },
      ];
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) (where.createdAt as Record<string, unknown>).gte = new Date(fromDate);
      if (toDate) (where.createdAt as Record<string, unknown>).lte = new Date(toDate + 'T23:59:59.999Z');
    }

    const [wishes, total] = await Promise.all([
      db.wish.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wish.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Total count for stats
    const totalCount = await db.wish.count({ where: { weddingId } });

    return Response.json({
      success: true,
      data: {
        wishes: wishes.map((w) => ({
          id: w.id,
          weddingId: w.weddingId,
          name: w.name,
          relationship: w.relationship,
          message: w.message,
          imageUrl: w.imageUrl,
          createdAt: w.createdAt.toISOString(),
        })),
        total,
        page,
        limit,
        totalPages,
        stats: {
          total: totalCount,
        },
      },
    });
  } catch (err) {
    console.error('Wishes list error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}