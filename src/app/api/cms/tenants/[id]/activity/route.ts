import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — Combined activity feed for a wedding
// ============================================

interface ActivityItem {
  id: string;
  type: 'rsvp' | 'wish';
  name: string;
  action: string;
  createdAt: string;
}

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
    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:read');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have access to this wedding.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '8')));

    // Fetch recent RSVPs and Wishes in parallel
    const [recentRsvps, recentWishes] = await Promise.all([
      db.rSVPSubmission.findMany({
        where: { weddingId },
        include: { guests: true },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      db.wish.findMany({
        where: { weddingId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    // Map to activity items
    const rsvpActivities: ActivityItem[] = recentRsvps.map((r) => ({
      id: `rsvp-${r.id}`,
      type: 'rsvp' as const,
      name: `${r.firstName} ${r.lastName}`,
      action: `RSVP submitted for ${r.partySize} guest${r.partySize !== 1 ? 's' : ''}`,
      createdAt: r.createdAt.toISOString(),
    }));

    const wishActivities: ActivityItem[] = recentWishes.map((w) => ({
      id: `wish-${w.id}`,
      type: 'wish' as const,
      name: w.name,
      action: 'Sent a wish',
      createdAt: w.createdAt.toISOString(),
    }));

    // Merge and sort by date, take top N
    const allActivities = [...rsvpActivities, ...wishActivities]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return Response.json({
      success: true,
      data: {
        activities: allActivities,
      },
    });
  } catch (err) {
    console.error('Activity feed error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}