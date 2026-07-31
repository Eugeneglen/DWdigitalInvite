import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { hasPlatformPermission } from '@/lib/permissions';

// GET /api/wedding/public?slug=eleanor-james
// Returns all wedding data needed by guest-facing pages.
// - Guests (no auth): only see ACTIVE weddings
// - Platform staff (SUPER_ADMIN, ACCOUNT_MANAGER_1/2, SUPPORT): can preview any wedding by slug
// - Authenticated couple (COUPLE): can preview their own wedding by slug
//   (even if DRAFT), so they can see their changes on the guest site
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    // Check if the requester is platform staff (admin preview)
    const session = await getServerSession();
    const role = session?.user?.role;
    const isAdmin = hasPlatformPermission(role || '', 'platform:weddings:read') ||
                    hasPlatformPermission(role || '', 'platform:weddings:read-all');

    // Build the where clause:
    // - No slug → first ACTIVE wedding (platform landing page)
    // - Slug + admin → any wedding with that slug (preview DRAFT etc.)
    // - Slug + couple owner → their own wedding (even if DRAFT)
    // - Slug + guest → only ACTIVE weddings
    let where: Record<string, unknown>;
    if (!slug) {
      where = { status: 'ACTIVE' };
    } else if (isAdmin) {
      where = { slug };
    } else {
      // Try to find the wedding by slug — if it belongs to the logged-in
      // couple, allow it regardless of status; otherwise require ACTIVE
      where = { slug, status: 'ACTIVE' };
    }

    let wedding = await db.weddingAccount.findFirst({
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

    // If not found with ACTIVE filter, check if the logged-in couple owns it
    if (!wedding && slug && !isAdmin && session?.user?.id) {
      wedding = await db.weddingAccount.findFirst({
        where: { slug, ownerId: session.user.id },
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
    }

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

    // Build feature flags map — each animation style is its own feature row
    // ('animation:gold-dust', 'animation:flying-stars', 'animation:raining').
    // The guest site reads these individual flags to decide which animations render.
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