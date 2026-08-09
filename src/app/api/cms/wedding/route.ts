import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { promises as fsp } from 'fs';
import path from 'path';
import { IS_VOLUME_STORAGE } from '@/lib/file-storage';

// In-memory set of wedding IDs that have been self-healed this server instance.
// Prevents repeated filesystem checks on every GET request.
const healedWeddings = new Set<string>();

/** Check whether a filesystem-based URL actually has a file behind it. */
async function fileExistsForUrl(url: string): Promise<boolean> {
  if (!url || !url.startsWith('/')) return false;

  let relativePath = '';
  if (url.startsWith('/api/uploads/weddings/')) {
    relativePath = url.substring('/api/uploads/weddings/'.length);
  } else if (url.startsWith('/uploads/weddings/')) {
    relativePath = url.substring('/uploads/weddings/'.length);
  } else {
    return false; // Not a filesystem URL (might be data: URL, etc.)
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
    const allowedFields = ['coupleName', 'brideName', 'groomName', 'weddingDate', 'weddingTime', 'venue', 'venueAddress', 'googleMapsUrl', 'heroImageUrl', 'heroVideoUrl', 'bannerUrl'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = field === 'weddingDate' ? new Date(body[field]) : body[field];
      }
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
