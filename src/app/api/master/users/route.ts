import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { z } from 'zod/v4';
import { hasPlatformPermission, normalizePlatformRole } from '@/lib/permissions';

// ── Schemas ───────────────────────────────────────────────────────────────
// Accept the new DB-driven vocabulary (SUPER_ADMIN_1, CONSULTANT_1, etc.)
// plus legacy values for backward compatibility.

const ROLE_VALUES = [
  // New DB-driven vocabulary
  'SUPER_ADMIN_1', 'SUPER_ADMIN_2',
  'CONSULTANT_1', 'CONSULTANT_2',
  'COORDINATOR_1',
  'SUPPORT_1', 'SUPPORT_2',
  'COUPLE',
  // Legacy values (still accepted for backward compatibility)
  'SUPER_ADMIN', 'ACCOUNT_MANAGER', 'ACCOUNT_MANAGER_1', 'ACCOUNT_MANAGER_2',
  'SUPPORT', 'ADMIN_1', 'ADMIN_2', 'ADMIN_3',
] as const;

const createUserSchema = z.object({
  email: z.email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLE_VALUES),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  id: z.string().min(1),
  email: z.email('Invalid email address').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(ROLE_VALUES).optional(),
  isActive: z.boolean().optional(),
});

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can create users (defense-in-depth escalation gate)
    if (normalizePlatformRole(session.user.role) !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { email, name, password, role, isActive } = parsed.data;

    // Check email uniqueness
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        isActive,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entity: 'User',
        entityId: user.id,
        details: JSON.stringify({ email, name, role, isActive }),
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('User create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── PUT ───────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // Base access: anyone who can read weddings can update user details (name/email/password)
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:weddings:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { id, ...updates } = parsed.data;

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) {
      // Check email uniqueness if changing
      const existing = await db.user.findFirst({ where: { email: updates.email, NOT: { id } } });
      if (existing) {
        return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
      }
      updateData.email = updates.email;
    }
    if (updates.password) {
      updateData.passwordHash = await bcrypt.hash(updates.password, 12);
    }
    if (updates.role !== undefined) {
      // Only SUPER_ADMIN can change roles (defense-in-depth escalation gate).
      // ACCOUNT_MANAGER_* users cannot escalate themselves or others.
      if (normalizePlatformRole(session.user.role) !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Only Super Admins can change user roles' }, { status: 403 });
      }
      updateData.role = updates.role;
    }
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        details: JSON.stringify(updates),
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('User update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can delete users (defense-in-depth escalation gate)
    if (normalizePlatformRole(session.user.role) !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const hard = searchParams.get('hard') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    if (hard) {
      // Hard delete — remove user and all their data in a transaction
      await db.$transaction([
        // Null out ownership of any weddings they own
        db.weddingAccount.updateMany({ where: { ownerId: id }, data: { ownerId: null } }),
        // Null out consultant/coordinator assignments
        db.weddingAccount.updateMany({ where: { consultantId: id }, data: { consultantId: null } }),
        db.weddingAccount.updateMany({ where: { coordinatorId: id }, data: { coordinatorId: null } }),
        // Remove their audit logs
        db.auditLog.deleteMany({ where: { userId: id } }),
        // Remove their notifications
        db.notification.deleteMany({ where: { userId: id } }),
        // Finally delete the user
        db.user.delete({ where: { id } }),
      ]);
    } else {
      await db.user.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entity: 'User',
        entityId: id,
        details: JSON.stringify({ hardDelete: hard }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('User delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}