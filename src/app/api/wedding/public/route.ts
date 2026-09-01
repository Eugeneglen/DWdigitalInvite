import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { hasPlatformPermission } from '@/lib/permissions';
import { promises as fsp } from 'fs';
import path from 'path';
import { IS_VOLUME_STORAGE } from '@/lib/file-storage';

// In-memory set of wedding IDs whose filesystem URLs have been checked.
const checkedWeddings = new Set<string>();

/**
 * Check whether a URL is expected to render.
 *
 * - External absolute URLs (http/https/…) are hosted off-platform (e.g. the
 *   template's aida-public banner/hero images). They cannot and should not
 *   be filesystem-verified — treat them as valid. Previously they returned
 *   false, so the self-heal NULLED every template-seeded banner/hero URL on
 *   the first preview of a newly created couple ("banner missing on all
 *   pages").
 * - Local filesystem URLs (/api/uploads/weddings/…, /uploads/weddings/…)
 *   are verified against disk (volume first, then public/uploads).
 */
async function fileExistsForUrl(url: string): Promise<boolean> {
  if (!url) return false;
  // Not a site-relative path → an external (or otherwise non-filesystem)
  // resource. Assume it resolves; only local uploads can be verified here.
  if (!url.startsWith('/')) return true;
  let relativePath = '';
  if (url.startsWith('/api/uploads/weddings/')) {
    relativePath = url.substring('/api/uploads/weddings/'.length);
  } else if (url.startsWith('/uploads/weddings/')) {
    relativePath = url.substring('/uploads/weddings/'.length);
  } else {
    // Unknown path shape (not an uploads URL) — not a managed filesystem
    // asset; assume valid rather than wiping it.
    return true;
  }
  const candidates: string[] = [];
  if (IS_VOLUME_STORAGE) {
    candidates.push(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '', 'uploads', 'weddings', relativePath));
  }
  candidates.push(path.join(process.cwd(), 'public', 'uploads', 'weddings', relativePath));
  for (const p of candidates) {
    try { await fsp.access(p); return true; } catch { /* not found */ }
  }
  return false;
}

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
    const userId = session?.user?.id || '';
    // If no session (guest), isAdmin is false. If logged in, check DB-driven permissions.
    const isAdmin = userId
      ? (await hasPlatformPermission(userId, role || '', 'platform:weddings:read')) ||
        (await hasPlatformPermission(userId, role || '', 'platform:weddings:read-all'))
      : false;

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

    // ── Self-heal: null out broken filesystem URLs for hero/banner/heroVideo ──
    // On Railway (ephemeral filesystem), files are lost after deploys but DB URLs remain.
    // One-time check per wedding per server instance. Returns null so the guest site
    // falls back to its built-in placeholder images.
    //
    // External URLs (template-seeded banner/hero images) are NOT filesystem
    // assets and are never nulled (see fileExistsForUrl).
    //
    // The DB update below IS the heal — the response always reflects the
    // CURRENT DB row. There is deliberately no "broken" cache masking the
    // response: a couple can upload a new banner right after a heal and the
    // API must serve it immediately, without a server restart. (The old
    // brokenUrlCache kept nulling the field for the whole process lifetime
    // — that is why a freshly added banner image never showed.)
    let heroImageUrl: string | null = wedding.heroImageUrl;
    let bannerUrl: string | null = wedding.bannerUrl;
    let heroVideoUrl: string | null = wedding.heroVideoUrl;

    if (!checkedWeddings.has(wedding.id)) {
      checkedWeddings.add(wedding.id);
      const updates: Record<string, string | null> = {};

      const fieldMap: Record<string, string | null> = {
        heroImageUrl,
        bannerUrl,
        heroVideoUrl,
      };

      for (const [field, url] of Object.entries(fieldMap)) {
        if (url && typeof url === 'string' && !url.startsWith('data:')) {
          const exists = await fileExistsForUrl(url);
          if (!exists) {
            updates[field] = null;
            if (field === 'heroImageUrl') heroImageUrl = null;
            else if (field === 'bannerUrl') bannerUrl = null;
            else if (field === 'heroVideoUrl') heroVideoUrl = null;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        console.log(`[self-heal:public] Clearing broken URLs for wedding ${wedding.id}:`, Object.keys(updates));
        try {
          await db.weddingAccount.update({ where: { id: wedding.id }, data: updates });
        } catch (err) {
          // Non-fatal: the response already omits the broken URLs; the DB
          // will be re-healed on the next server instance.
          console.error('[self-heal:public] DB update failed:', err);
        }
      }
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
        heroImageUrl,
        heroVideoUrl,
        bannerUrl,
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
