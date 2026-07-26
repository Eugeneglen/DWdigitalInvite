import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

async function getWeddingId(userId: string): Promise<{ id: string; plan: string } | null> {
  const w = await db.weddingAccount.findFirst({
    where: { ownerId: userId },
    select: { id: true, plan: true },
  });
  return w ? { id: w.id, plan: w.plan } : null;
}

// GET /api/cms/features — get all features for couple's wedding
//
// Each animation style is now its own WeddingFeature row
// ('animation:gold-dust', 'animation:flying-stars', 'animation:raining').
// The couple's CMS reads these individual rows to render per-style toggles.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const wedding = await getWeddingId(session.user.id);
    if (!wedding) return NextResponse.json({ error: 'No wedding account' }, { status: 404 });

    const features = await db.weddingFeature.findMany({
      where: { weddingId: wedding.id },
      orderBy: { featureKey: 'asc' },
    });

    return NextResponse.json({
      features,
      plan: wedding.plan,
    });
  } catch (error) {
    console.error('Get features error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/cms/features — toggle features
//
// Couples can toggle any feature that has a WeddingFeature row. The admin
// controls which rows exist (via Create New Wedding wizard), so couples
// can only toggle animations the admin has made available.
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const wedding = await getWeddingId(session.user.id);
    if (!wedding) return NextResponse.json({ error: 'No wedding account' }, { status: 404 });
    const weddingId = wedding.id;

    const { features } = await req.json() as { features: { featureKey: string; isEnabled: boolean; config?: string }[] };

    if (!Array.isArray(features)) {
      return NextResponse.json({ error: 'features array required' }, { status: 400 });
    }

    const results = [];
    for (const f of features) {
      const existing = await db.weddingFeature.findFirst({
        where: { weddingId, featureKey: f.featureKey },
      });
      if (existing) {
        const updated = await db.weddingFeature.update({
          where: { id: existing.id },
          data: {
            isEnabled: f.isEnabled,
            ...(f.config !== undefined ? { config: f.config } : {}),
          },
        });
        results.push(updated);
      }
    }

    return NextResponse.json({ features: results });
  } catch (error) {
    console.error('Update features error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

