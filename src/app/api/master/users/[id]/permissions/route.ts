import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission, invalidateOverrideCache, ALL_PERMISSIONS } from '@/lib/permissions';
import { z } from 'zod/v4';

// ── GET /api/master/users/[id]/permissions — list overrides for a user ────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get the user's role permissions (from Role table)
    const role = await db.role.findUnique({
      where: { key: user.role },
      select: { key: true, label: true, permissions: true },
    });

    const rolePermissions = role ? JSON.parse(role.permissions) as string[] : [];

    // Get overrides
    const overrides = await db.userPermissionOverride.findMany({
      where: { userId },
      select: { id: true, permission: true, granted: true },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleLabel: role?.label || user.role,
      },
      rolePermissions,
      overrides: overrides.map((o) => ({
        id: o.id,
        permission: o.permission,
        granted: o.granted,
      })),
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT /api/master/users/[id]/permissions — set overrides (full replace) ─

const setOverridesSchema = z.object({
  overrides: z.array(z.object({
    permission: z.string(),
    granted: z.boolean(),
  })),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = await params;

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = setOverridesSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { overrides } = parsed.data;

    // Validate all permission strings are known
    const invalidPerms = overrides
      .map((o) => o.permission)
      .filter((p) => !ALL_PERMISSIONS.includes(p as never));
    if (invalidPerms.length > 0) {
      return NextResponse.json({ error: `Unknown permissions: ${invalidPerms.join(', ')}` }, { status: 400 });
    }

    // Delete all existing overrides, then create new ones
    await db.userPermissionOverride.deleteMany({ where: { userId } });

    if (overrides.length > 0) {
      await db.userPermissionOverride.createMany({
        data: overrides.map((o) => ({
          userId,
          permission: o.permission,
          granted: o.granted,
        })),
      });
    }

    invalidateOverrideCache(userId);

    return NextResponse.json({
      success: true,
      overridesCount: overrides.length,
    });
  } catch (error) {
    console.error('Set user permissions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
