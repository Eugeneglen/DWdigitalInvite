import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';
import { FEATURE_KEYS } from '@/lib/auth';

// ============================================
// GET — List wedding accounts (paginated, searchable)
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!(await hasPlatformPermission(user.userId, user.role, 'platform:weddings:read'))) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { coupleName: { contains: search } },
        { slug: { contains: search } },
        { brideName: { contains: search } },
        { groomName: { contains: search } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [accounts, total] = await Promise.all([
      db.weddingAccount.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              guests: true,
              features: true,
              rsvps: true,
              wishes: true,
            },
          },
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      db.weddingAccount.count({ where }),
    ]);

    return Response.json({
      success: true,
      data: {
        tenants: accounts.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          weddingDate: t.weddingDate?.toISOString() ?? null,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('List tenants error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Create wedding account
// ============================================

const createTenantSchema = z.object({
  coupleName: z.string().min(1, 'Couple name is required'),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens only'),
  brideName: z.string().optional(),
  groomName: z.string().optional(),
  weddingDate: z.string().optional(),
  venue: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!(await hasPlatformPermission(user.userId, user.role, 'platform:weddings:write'))) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createTenantSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { slug } = parsed.data;
    const existing = await db.weddingAccount.findUnique({ where: { slug } });
    if (existing) {
      return Response.json({ success: false, error: 'A wedding account with this slug already exists' }, { status: 400 });
    }

    const eventFeatures = [
      FEATURE_KEYS.RSVP,
      FEATURE_KEYS.WISHES,
      FEATURE_KEYS.STORY,
      FEATURE_KEYS.MOMENTS,
      FEATURE_KEYS.SCHEDULE,
      FEATURE_KEYS.QA,
      FEATURE_KEYS.GETTING_THERE,
    ];

    const account = await db.weddingAccount.create({
      data: {
        coupleName: parsed.data.coupleName,
        slug: parsed.data.slug,
        brideName: parsed.data.brideName ?? null,
        groomName: parsed.data.groomName ?? null,
        weddingDate: parsed.data.weddingDate ? new Date(parsed.data.weddingDate) : new Date(),
        venue: parsed.data.venue ?? null,
        ownerId: user.userId,
        features: {
          create: eventFeatures.map((key) => ({
            featureKey: key,
            isEnabled: true,
          })),
        },
      },
      include: {
        features: true,
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: 'tenant.create',
      resource: 'WeddingAccount',
      resourceId: account.id,
      weddingId: account.id,
      details: { ...parsed.data, weddingDate: parsed.data.weddingDate },
      request,
    });

    return Response.json(
      {
        success: true,
        data: {
          ...account,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
          weddingDate: account.weddingDate?.toISOString() ?? null,
          features: account.features.map((ft) => ({
            ...ft,
            createdAt: ft.createdAt.toISOString(),
            updatedAt: ft.updatedAt.toISOString(),
          })),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Create tenant error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}