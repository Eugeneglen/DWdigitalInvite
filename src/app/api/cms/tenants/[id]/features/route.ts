import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, requireTenantAccess, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — List feature toggles for a wedding
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

    // Phase 3b: Added role check (was missing — security gap fixed)
    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:read');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have access to this wedding.' }, { status: 403 });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const features = await db.weddingFeature.findMany({
      where: { weddingId },
      orderBy: { featureKey: 'asc' },
    });

    return Response.json({
      success: true,
      data: features.map((ft) => ({
        ...ft,
        createdAt: ft.createdAt.toISOString(),
        updatedAt: ft.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Get tenant features error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PATCH — Upsert a single feature toggle
// ============================================

const featureToggleSchema = z.object({
  featureKey: z.string().min(1, 'Feature key is required'),
  isEnabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const accessError = await requireTenantAccess(user, weddingId, 'admin');
    if (accessError) {
      return Response.json({ success: false, error: accessError }, { status: 403 });
    }

    const body = await request.json();
    const parsed = featureToggleSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { featureKey, isEnabled, config } = parsed.data;

    const toggle = await db.weddingFeature.upsert({
      where: {
        weddingId_featureKey: { weddingId, featureKey },
      },
      create: {
        weddingId,
        featureKey,
        isEnabled,
        config: config ? JSON.stringify(config) : undefined,
      },
      update: {
        isEnabled,
        ...(config !== undefined && { config: JSON.stringify(config) }),
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: 'feature.toggle',
      resource: 'WeddingFeature',
      resourceId: toggle.id,
      weddingId,
      details: { featureKey, isEnabled, config },
      request,
    });

    return Response.json({
      success: true,
      data: {
        ...toggle,
        createdAt: toggle.createdAt.toISOString(),
        updatedAt: toggle.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Toggle feature error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PUT — Bulk update feature toggles
// ============================================

const bulkFeaturesSchema = z.object({
  features: z.array(featureToggleSchema).min(1, 'At least one feature is required'),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const accessError = await requireTenantAccess(user, weddingId, 'admin');
    if (accessError) {
      return Response.json({ success: false, error: accessError }, { status: 403 });
    }

    const body = await request.json();
    const parsed = bulkFeaturesSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { features } = parsed.data;

    const results = await db.$transaction(
      features.map((f) =>
        db.weddingFeature.upsert({
          where: {
            weddingId_featureKey: { weddingId, featureKey: f.featureKey },
          },
          create: {
            weddingId,
            featureKey: f.featureKey,
            isEnabled: f.isEnabled,
            config: f.config ? JSON.stringify(f.config) : undefined,
          },
          update: {
            isEnabled: f.isEnabled,
            ...(f.config !== undefined && { config: JSON.stringify(f.config) }),
          },
        })
      )
    );

    await createAuditLog({
      userId: user.userId,
      action: 'feature.bulk_toggle',
      resource: 'WeddingFeature',
      weddingId,
      details: { count: features.length, features: features.map((f) => ({ featureKey: f.featureKey, isEnabled: f.isEnabled })) },
      request,
    });

    return Response.json({
      success: true,
      data: results.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Bulk toggle features error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}