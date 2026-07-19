import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';

// GET /api/wedding/public?slug=eleanor-james
// Returns all wedding data needed by guest-facing pages.
// Admins (SUPER_ADMIN, ADMIN_1, ADMIN_2) can preview non-ACTIVE weddings.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    // Check if the requester is an admin (for previewing DRAFT/SUSPENDED weddings)
    const session = await getServerSession();
    const role = session?.user?.role;
    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN_1' || role === 'ADMIN_2';

    // When no slug is provided (platform home page), fall back to the
    // first active wedding so the landing page renders a real invitation.
    // Admins can see any wedding by slug; guests only see ACTIVE.
    const where = slug
      ? (isAdmin ? { slug } : { slug, status: 'ACTIVE' as const })
      : { status: 'ACTIVE' as const };

    const wedding = await db.weddingAccount.findFirst({
      where,
      orderBy: slug ? undefined : { createdAt: 'asc' },
      include: {
        content: true,
        schedules: { orderBy: { sortOrder: 'asc' } },
        faqs: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        stories: { orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' }, take: 100 },
        features: true,
        wishes: { orderBy: { createdAt: 'desc' }, take: 50 },
        rsvps: { select: { id: true, firstName: true, lastName: true, partySize: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { wishes: true, rsvps: true } },
      },
    });

    if (!wedding) {
      return NextResponse.json({ error: 'Wedding not found' }, { status: 404 });
    }

    // Transform content array into nested map for easy lookup
    const contentMap: Record<string, Record<string, string>> = {};
    for (const c of wedding.content) {
      if (!contentMap[c.section]) contentMap[c.section] = {};
      contentMap[c.section][c.fieldKey] = c.fieldValue;
    }

    // Group media by category
    const mediaByCategory: Record<string, typeof wedding.media> = {};
    for (const m of wedding.media) {
      if (!mediaByCategory[m.category]) mediaByCategory[m.category] = [];
      mediaByCategory[m.category].push(m);
    }

    // Build feature flags map
    const featureFlags: Record<string, boolean> = {};
    const featureConfigs: Record<string, Record<string, unknown>> = {};
    for (const f of wedding.features) {
      featureFlags[f.featureKey] = f.isEnabled;
      if (f.config) {
        try {
          featureConfigs[f.featureKey] = JSON.parse(f.config);
        } catch {
          // ignore malformed config
        }
      }
    }

    return NextResponse.json({
      wedding: {
        id: wedding.id,
        slug: wedding.slug,
        coupleName: wedding.coupleName,
        brideName: wedding.brideName,
        groomName: wedding.groomName,
        weddingDate: wedding.weddingDate,
        weddingTime: wedding.weddingTime,
        venue: wedding.venue,
        venueAddress: wedding.venueAddress,
        googleMapsUrl: wedding.googleMapsUrl,
        heroImageUrl: wedding.heroImageUrl,
        heroVideoUrl: wedding.heroVideoUrl,
        bannerUrl: wedding.bannerUrl,
      },
      content: contentMap,
      schedules: wedding.schedules,
      faqs: wedding.faqs,
      stories: wedding.stories,
      media: wedding.media,
      mediaByCategory,
      featureFlags,
      featureConfigs,
      rsvpCount: wedding._count.rsvps,
      totalGuestCount: wedding.rsvps.reduce((sum, r) => sum + r.partySize, 0),
      totalWishCount: wedding._count.wishes,
      totalRsvpCount: wedding._count.rsvps,
      wishes: wedding.wishes.map((w) => ({
        id: w.id,
        name: w.name,
        relationship: w.relationship,
        message: w.message,
        imageUrl: w.imageUrl,
        createdAt: w.createdAt,
      })),
    });
  } catch (error) {
    console.error('Public wedding API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}