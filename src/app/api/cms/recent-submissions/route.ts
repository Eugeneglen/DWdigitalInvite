import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';

// ============================================
// GET — Recent submissions across ALL tenants (master admin dashboard)
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await authenticateRequest(request);
    if (authError || !user) {
      return Response.json({ success: false, error: authError || 'Authentication required' }, { status: 401 });
    }

    if (!hasPlatformPermission(user.role, 'platform:weddings:read')) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'rsvp';
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '5')));

    if (type === 'wish') {
      const wishes = await db.wish.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return Response.json({
        success: true,
        data: wishes.map((w) => ({
          id: w.id,
          type: 'wish',
          name: w.name,
          action: 'Sent a wish',
          createdAt: w.createdAt.toISOString(),
        })),
      });
    }

    // Default: RSVP
    const rsvps = await db.rSVPSubmission.findMany({
      include: { guests: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return Response.json({
      success: true,
      data: rsvps.map((r) => ({
        id: r.id,
        type: 'rsvp',
        name: `${r.firstName} ${r.lastName}`,
        action: `RSVP for ${r.partySize} guest${r.partySize !== 1 ? 's' : ''}`,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('Recent submissions error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}