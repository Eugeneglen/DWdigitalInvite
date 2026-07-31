import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';

// ============================================
// GET — All wedding features across all weddings (global view)
// Note: There is no GlobalFeatureToggle model.
//       This returns a unique set of feature keys used across all weddings
//       with a count of how many have them enabled.
// ============================================

export async function GET(request: Request) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    // Phase 3b: Added role check (was missing — security gap fixed)
    if (!(await hasPlatformPermission(user.userId, user.role, 'platform:weddings:read'))) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    // Aggregate feature keys across all weddings
    const allFeatures = await db.weddingFeature.findMany({
      select: { featureKey: true, isEnabled: true },
    });

    // Group by featureKey
    const grouped = new Map<string, { total: number; enabled: number }>();
    for (const f of allFeatures) {
      const entry = grouped.get(f.featureKey) ?? { total: 0, enabled: 0 };
      entry.total += 1;
      if (f.isEnabled) entry.enabled += 1;
      grouped.set(f.featureKey, entry);
    }

    return Response.json({
      success: true,
      data: Array.from(grouped.entries()).map(([featureKey, counts]) => ({
        featureKey,
        totalWeddings: counts.total,
        enabledCount: counts.enabled,
      })),
    });
  } catch (err) {
    console.error('Get global features error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PATCH — Not supported: per-wedding feature toggles
//       exist at /api/cms/tenants/[id]/features
// ============================================

export async function PATCH(request: Request) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!(await hasPlatformPermission(user.userId, user.role, 'platform:templates:manage'))) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    // Global feature toggles are not supported.
    // Use per-wedding feature management at /api/cms/tenants/[id]/features
    return Response.json(
      {
        success: false,
        error: 'Global feature toggles are not supported. Manage features per-wedding at /api/cms/tenants/[id]/features.',
      },
      { status: 400 }
    );
  } catch (err) {
    console.error('Toggle global feature error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}