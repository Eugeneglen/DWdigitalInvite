import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { z } from 'zod/v4';
import { hasPlatformPermission, invalidateRoleCache, ALL_PERMISSIONS } from '@/lib/permissions';

// ── GET /api/master/roles — list all roles ────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    // Any authenticated user can read roles (needed for UI dropdowns)
    const roles = await db.role.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      roles: roles.map((r) => ({
        id: r.id,
        key: r.key,
        label: r.label,
        tier: r.tier,
        isSystem: r.isSystem,
        permissions: JSON.parse(r.permissions) as string[],
        sortOrder: r.sortOrder,
      })),
    });
  } catch (error) {
    console.error('Roles list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST /api/master/roles — create a new role ────────────────────────────

const createRoleSchema = z.object({
  key: z.string().min(2).max(50).regex(/^[A-Z][A-Z0-9_]*$/, 'Key must be UPPER_SNAKE_CASE'),
  label: z.string().min(2).max(100),
  tier: z.enum(['platform', 'wedding_staff', 'account']),
  permissions: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { key, label, tier, permissions } = parsed.data;

    // Validate all permission strings are known
    const invalidPerms = permissions.filter((p) => !ALL_PERMISSIONS.includes(p as never) && p !== '*');
    if (invalidPerms.length > 0) {
      return NextResponse.json({ error: `Unknown permissions: ${invalidPerms.join(', ')}` }, { status: 400 });
    }

    // Check key uniqueness
    const existing = await db.role.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json({ error: 'A role with this key already exists' }, { status: 409 });
    }

    const maxSortOrder = await db.role.aggregate({ _max: { sortOrder: true } });
    const sortOrder = (maxSortOrder._max.sortOrder || 0) + 1;

    const role = await db.role.create({
      data: {
        key,
        label,
        tier,
        isSystem: false, // user-created roles are never system roles
        permissions: JSON.stringify(permissions),
        sortOrder,
      },
    });

    invalidateRoleCache();

    return NextResponse.json({
      role: {
        id: role.id,
        key: role.key,
        label: role.label,
        tier: role.tier,
        isSystem: role.isSystem,
        permissions: JSON.parse(role.permissions) as string[],
        sortOrder: role.sortOrder,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Role create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PATCH /api/master/roles — update a role ───────────────────────────────

const updateRoleSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(2).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateRoleSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { id, label, permissions, sortOrder } = parsed.data;

    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Validate permissions if provided
    if (permissions) {
      const invalidPerms = permissions.filter((p) => !ALL_PERMISSIONS.includes(p as never) && p !== '*');
      if (invalidPerms.length > 0) {
        return NextResponse.json({ error: `Unknown permissions: ${invalidPerms.join(', ')}` }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (label !== undefined) updateData.label = label;
    if (permissions !== undefined) updateData.permissions = JSON.stringify(permissions);
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const role = await db.role.update({
      where: { id },
      data: updateData,
    });

    invalidateRoleCache();

    return NextResponse.json({
      role: {
        id: role.id,
        key: role.key,
        label: role.label,
        tier: role.tier,
        isSystem: role.isSystem,
        permissions: JSON.parse(role.permissions) as string[],
        sortOrder: role.sortOrder,
      },
    });
  } catch (error) {
    console.error('Role update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE /api/master/roles — delete a role ──────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Role ID required' }, { status: 400 });
    }

    const existing = await db.role.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Cannot delete system roles
    if (existing.isSystem) {
      return NextResponse.json({ error: 'System roles cannot be deleted' }, { status: 400 });
    }

    // Check if any users are assigned to this role
    const userCount = await db.user.count({ where: { role: existing.key } });
    if (userCount > 0) {
      return NextResponse.json({
        error: `Cannot delete role: ${userCount} user(s) are assigned to it. Reassign them first.`,
      }, { status: 400 });
    }

    await db.role.delete({ where: { id } });

    invalidateRoleCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Role delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
