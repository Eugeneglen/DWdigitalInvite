import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { hasPlatformPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:read'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const accounts = await db.weddingAccount.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        coupleName: true,
        brideName: true,
        groomName: true,
        status: true,
        plan: true,
        weddingDate: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            rsvps: true,
            wishes: true,
            guests: true,
          },
        },
      },
    });

    const result = accounts.map((a) => ({
      id: a.id,
      slug: a.slug,
      coupleName: a.coupleName,
      brideName: a.brideName,
      groomName: a.groomName,
      status: a.status,
      plan: a.plan,
      weddingDate: a.weddingDate,
      owner: a.owner,
      rsvpCount: a._count.rsvps,
      wishCount: a._count.wishes,
      guestCount: a._count.guests,
      createdAt: a.createdAt,
    }));

    return NextResponse.json({ accounts: result });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:write'))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { slug, brideName, groomName, coupleName, weddingDate, plan, ownerId } = body;

    if (!slug || !coupleName) {
      return NextResponse.json(
        { error: 'slug and coupleName are required' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must be lowercase alphanumeric with hyphens' },
        { status: 400 }
      );
    }

    const existing = await db.weddingAccount.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this slug already exists' },
        { status: 409 }
      );
    }

    const account = await db.weddingAccount.create({
      data: {
        slug,
        coupleName,
        brideName: brideName || null,
        groomName: groomName || null,
        weddingDate: weddingDate ? new Date(weddingDate) : new Date(),
        plan: plan || 'GOLD',
        ownerId: ownerId || session.user.id,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}