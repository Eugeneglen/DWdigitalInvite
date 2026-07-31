import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';

// ============================================
// GET — Dashboard stats (role-dependent)
// ============================================

export async function GET(request: Request) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if ((await hasPlatformPermission(user.userId, user.role, 'platform:weddings:read'))) {
      const [totalTenants, activeTenants, totalUsers, recentLogCount] = await Promise.all([
        db.weddingAccount.count(),
        db.weddingAccount.count({ where: { status: 'ACTIVE' } }),
        db.user.count(),
        db.auditLog.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
        }),
      ]);

      return Response.json({
        success: true,
        data: {
          totalTenants,
          activeTenants,
          totalUsers,
          recentLogCount,
        },
      });
    }

    // Couple/wedding-specific stats
    if (user.tenantId) {
      const [totalRsvps, totalWishes, totalContacts, features] = await Promise.all([
        db.rSVPSubmission.count({ where: { weddingId: user.tenantId } }),
        db.wish.count({ where: { weddingId: user.tenantId } }),
        db.contactSubmission.count({ where: { weddingId: user.tenantId } }),
        db.weddingFeature.findMany({
          where: { weddingId: user.tenantId },
          select: { featureKey: true, isEnabled: true },
        }),
      ]);

      return Response.json({
        success: true,
        data: {
          totalRsvps,
          totalWishes,
          totalContacts,
          features: features.map((ft) => ({
            featureKey: ft.featureKey,
            isEnabled: ft.isEnabled,
          })),
        },
      });
    }

    // Fallback for users without wedding
    return Response.json({
      success: true,
      data: {},
    });
  } catch (err) {
    console.error('Stats error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}