import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';

// ============================================
// GET — Single wedding account with features
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

    if (!hasPlatformPermission(user.role, 'platform:weddings:read')) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;
    const account = await db.weddingAccount.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, updatedAt: true },
        },
        features: true,
        _count: {
          select: {
            guests: true,
            rsvps: true,
            wishes: true,
            media: true,
            schedules: true,
            faqs: true,
          },
        },
      },
    });

    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      data: {
        ...account,
        weddingDate: account.weddingDate?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        owner: account.owner ? {
          ...account.owner,
          createdAt: account.owner.createdAt.toISOString(),
          updatedAt: account.owner.updatedAt.toISOString(),
        } : null,
        features: account.features.map((ft) => ({
          ...ft,
          createdAt: ft.createdAt.toISOString(),
          updatedAt: ft.updatedAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    console.error('Get tenant error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PATCH — Update wedding account
// ============================================

const updateTenantSchema = z.object({
  coupleName: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens only')
    .optional(),
  status: z.string().optional(),
  brideName: z.string().nullable().optional(),
  groomName: z.string().nullable().optional(),
  weddingDate: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  venueAddress: z.string().nullable().optional(),
  googleMapsUrl: z.string().nullable().optional(),
  heroImageUrl: z.string().nullable().optional(),
  heroVideoUrl: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  plan: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!hasPlatformPermission(user.role, 'platform:weddings:write')) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.weddingAccount.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTenantSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const data: Record<string, unknown> = { ...parsed.data };
    if (data.weddingDate !== undefined) {
      data.weddingDate = data.weddingDate ? new Date(data.weddingDate as string) : null;
    }

    // Check slug uniqueness if changing
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await db.weddingAccount.findUnique({ where: { slug: data.slug as string } });
      if (slugExists) {
        return Response.json({ success: false, error: 'A wedding account with this slug already exists' }, { status: 400 });
      }
    }

    const updated = await db.weddingAccount.update({
      where: { id },
      data,
    });

    await createAuditLog({
      userId: user.userId,
      action: 'tenant.update',
      resource: 'WeddingAccount',
      resourceId: id,
      weddingId: id,
      details: {
        before: {
          coupleName: existing.coupleName,
          slug: existing.slug,
          status: existing.status,
        },
        after: {
          coupleName: updated.coupleName,
          slug: updated.slug,
          status: updated.status,
        },
      },
      request,
    });

    return Response.json({
      success: true,
      data: {
        ...updated,
        weddingDate: updated.weddingDate?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update tenant error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Remove wedding account
// ============================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!hasPlatformPermission(user.role, 'platform:weddings:write')) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.weddingAccount.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    await db.weddingAccount.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: 'tenant.delete',
      resource: 'WeddingAccount',
      resourceId: id,
      weddingId: id,
      details: { coupleName: existing.coupleName, slug: existing.slug },
      request,
    });

    return Response.json({ success: true, data: { id } });
  } catch (err) {
    console.error('Delete tenant error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}