import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { promises as fsp } from 'fs';
import path from 'path';
import { IS_VOLUME_STORAGE } from '@/lib/file-storage';
import { clampFocal, normalizeDisplayMode } from '@/lib/hero-focal';

// In-memory set of wedding IDs that have been self-healed this server instance.
// Prevents repeated filesystem checks on every GET request.
const healedWeddings = new Set<string>();

/**
 * Check whether a URL is expected to render.
 *
 * - External absolute URLs (http/https/…) are hosted off-platform (e.g. the
 *   template's aida-public banner/hero images) and cannot be filesystem-
 *   verified — treat them as valid. Returning false for them (previous
 *   behaviour) made the self-heal wipe template-seeded banner/hero URLs
 *   from the DB on the couple's first CMS load.
 * - Local filesystem URLs (/api/uploads/weddings/…, /uploads/weddings/…)
 *   are verified against disk (volume first, then public/uploads).
 */
async function fileExistsForUrl(url: string): Promise<boolean> {
  if (!url) return false;
  // Not a site-relative path → external/non-filesystem resource; assume valid.
  if (!url.startsWith('/')) return true;

  let relativePath = '';
  if (url.startsWith('/api/uploads/weddings/')) {
    relativePath = url.substring('/api/uploads/weddings/'.length);
  } else if (url.startsWith('/uploads/weddings/')) {
    relativePath = url.substring('/uploads/weddings/'.length);
  } else {
    // Unknown path shape — not a managed filesystem asset; assume valid.
    return true;
  }

  // Try volume path first (Railway), then local public/uploads
  const candidates: string[] = [];
  if (IS_VOLUME_STORAGE) {
    candidates.push(path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '', 'uploads', 'weddings', relativePath));
  }
  candidates.push(path.join(process.cwd(), 'public', 'uploads', 'weddings', relativePath));

  for (const p of candidates) {
    try {
      await fsp.access(p);
      return true;
    } catch {
      // not found, try next
    }
  }
  return false;
}

// GET /api/cms/wedding — get the couple's own wedding account
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
      include: {
        features: true,
        content: true,
        schedules: { orderBy: { sortOrder: 'asc' } },
        stories: { orderBy: { sortOrder: 'asc' } },
        faqs: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        media: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { rsvps: true, wishes: true, guests: true, contacts: true } },
      },
    });

    if (!wedding) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    // ── Self-heal: clear broken filesystem URLs for hero/banner/heroVideo ──
    // After a Railway deploy, files on the ephemeral filesystem are gone but
    // the DB still has URLs pointing to them. On the first CMS load, check
    // these URLs and clear any that don't have a backing file.  This is a
    // one-time check per wedding per server instance.
    if (!healedWeddings.has(wedding.id)) {
      healedWeddings.add(wedding.id);

      const fsFields = ['heroImageUrl', 'bannerUrl', 'heroVideoUrl'] as const;
      const updates: Record<string, string | null> = {};
      let needsUpdate = false;

      for (const field of fsFields) {
        const url = wedding[field];
        if (url && typeof url === 'string' && !url.startsWith('data:')) {
          const exists = await fileExistsForUrl(url);
          if (!exists) {
            updates[field] = null;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        console.log(`[self-heal] Clearing broken filesystem URLs for wedding ${wedding.id}:`, Object.keys(updates));
        await db.weddingAccount.update({
          where: { id: wedding.id },
          data: updates,
        });
        // Re-fetch with full includes to return healed data
        const healed = await db.weddingAccount.findFirst({
          where: { id: wedding.id },
          include: {
            features: true,
            content: true,
            schedules: { orderBy: { sortOrder: 'asc' } },
            stories: { orderBy: { sortOrder: 'asc' } },
            faqs: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
            media: { orderBy: { sortOrder: 'asc' } },
            _count: { select: { rsvps: true, wishes: true, guests: true, contacts: true } },
          },
        });
        return NextResponse.json({ wedding: healed });
      }
    }

    return NextResponse.json({ wedding });
  } catch (error) {
    console.error('Get wedding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/cms/wedding — update wedding account details
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const wedding = await db.weddingAccount.findFirst({
      where: { ownerId: session.user.id },
    });

    if (!wedding) {
      return NextResponse.json({ error: 'No wedding account found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['coupleName', 'brideName', 'groomName', 'weddingDate', 'weddingTime', 'venue', 'venueAddress', 'googleMapsUrl', 'heroImageUrl', 'heroVideoUrl', 'bannerUrl', 'heroFocalX', 'heroFocalY', 'heroDisplayMode'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === 'weddingDate' ? new Date(body[field]) : body[field];
      }
    }

    // ── Mobile hero framing validation (additive, zero-regression) ──────────
    // Focal coordinates must be numbers in [0,1] (or null/'' to clear →
    // legacy centre crop). Display mode accepts 'fill' | 'fit' (or null/'' →
    // legacy fill). Reject anything else with 400 rather than persisting junk.
    const framingError = validateFramingFields(body);
    if (framingError) {
      return NextResponse.json({ error: framingError }, { status: 400 });
    }
    if (updateData.heroFocalX !== undefined) {
      updateData.heroFocalX = body.heroFocalX === '' || body.heroFocalX === null ? null : clampFocal(Number(body.heroFocalX));
    }
    if (updateData.heroFocalY !== undefined) {
      updateData.heroFocalY = body.heroFocalY === '' || body.heroFocalY === null ? null : clampFocal(Number(body.heroFocalY));
    }
    if (updateData.heroDisplayMode !== undefined) {
      updateData.heroDisplayMode = body.heroDisplayMode === '' || body.heroDisplayMode === null ? null : normalizeDisplayMode(body.heroDisplayMode);
    }

    // Stale-focal guard: when a NEW hero image is saved without explicit focal
    // coordinates in the same request, clear any previously saved focal point —
    // it belongs to the OLD photo and would mis-crop the new one. (Uploads that
    // ran auto-detection send heroFocalX/Y in the same body and keep theirs.)
    if (
      body.heroImageUrl !== undefined &&
      body.heroFocalX === undefined &&
      body.heroFocalY === undefined
    ) {
      updateData.heroFocalX = null;
      updateData.heroFocalY = null;
    }

    const updated = await db.weddingAccount.update({
      where: { id: wedding.id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        weddingId: wedding.id,
        action: 'UPDATE',
        entity: 'WeddingAccount',
        entityId: wedding.id,
        details: JSON.stringify(Object.keys(updateData)),
      },
    });

    return NextResponse.json({ wedding: updated });
  } catch (error) {
    console.error('Update wedding error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Validate mobile hero framing fields when present in a PUT body.
 * Returns an error message, or null when everything is valid/absent.
 * Accepts: number 0..1, null, '' (clear) for focal; 'fill'|'fit'|null|'' for mode.
 */
function validateFramingFields(body: Record<string, unknown>): string | null {
  for (const key of ['heroFocalX', 'heroFocalY'] as const) {
    const v = body[key];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
      return `${key} must be a number between 0 and 1, or null to reset`;
    }
  }
  const mode = body.heroDisplayMode;
  if (mode === undefined || mode === null || mode === '') return null;
  if (typeof mode !== 'string' || !['fill', 'fit'].includes(mode.trim().toLowerCase())) {
    return 'heroDisplayMode must be "fill" or "fit"';
  }
  return null;
}
