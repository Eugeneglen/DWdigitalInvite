import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';

// ============================================
// GET — Paginated, filtered audit logs
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!(await hasPlatformPermission(user.userId, user.role, 'platform:audit:read'))) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const userId = searchParams.get('userId') || '';
    const tenantId = searchParams.get('tenantId') || '';
    const action = searchParams.get('action') || '';
    const entity = searchParams.get('entity') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const search = (searchParams.get('search') || '').trim();

    const where: Record<string, unknown> = {};

    if (userId) where.userId = userId;
    if (tenantId) where.weddingId = tenantId;
    if (action) where.action = action;
    if (entity) where.entity = entity;

    if (fromDate || toDate) {
      const createdAt: Record<string, Date> = {};
      if (fromDate) createdAt.gte = new Date(fromDate);
      if (toDate) {
        // Add 1 day to make toDate inclusive of the entire day
        const end = new Date(toDate);
        end.setDate(end.getDate() + 1);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    // Server-side search: matches user name/email, entity, action, details.
    // SQLite doesn't support mode: 'insensitive', so we generate OR clauses
    // for common case variants. On PostgreSQL (Railway prod), this still works.
    if (search) {
      // Generate case variants of the search term
      const variants = [search, search.toLowerCase(), search.toUpperCase()];
      // Capitalize first letter (e.g. "Gleneugene")
      if (search.length > 0) {
        variants.push(search.charAt(0).toUpperCase() + search.slice(1));
      }
      const uniqueVariants = [...new Set(variants)];

      const orClauses: Record<string, unknown>[] = [];
      for (const v of uniqueVariants) {
        orClauses.push(
          { entity: { contains: v } },
          { action: { contains: v } },
          { details: { contains: v } },
          { user: { name: { contains: v } } },
          { user: { email: { contains: v } } },
        );
      }
      where.OR = orClauses;
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: {
        logs: logs.map((log) => ({
          ...log,
          createdAt: log.createdAt.toISOString(),
          user: log.user
            ? {
                id: log.user.id,
                name: log.user.name,
                email: log.user.email,
              }
            : null,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('List audit logs error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}