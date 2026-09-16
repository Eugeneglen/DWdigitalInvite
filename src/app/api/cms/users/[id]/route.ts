import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasPlatformPermission, normalizePlatformRole } from '@/lib/permissions';

/** R-02 lockout guard: true if this user is the LAST active Super Admin. */
async function isLastActiveSuperAdmin(userId: string): Promise<boolean> {
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  if (!target || !target.isActive) return false;
  if (!target.role.startsWith('SUPER_ADMIN')) return false;
  const activeSuperAdmins = await db.user.count({
    where: { role: { startsWith: 'SUPER_ADMIN' }, isActive: true },
  });
  return activeSuperAdmins <= 1;
}

// ============================================
// PATCH — Update user (name/email only)
// ============================================

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!(await hasPlatformPermission(user.userId, user.role, 'platform:users:manage'))) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    // R-02 (F-02): modifying another user's email is an account-takeover
    // primitive — SUPER_ADMIN only.
    if (normalizePlatformRole(user.role) !== 'SUPER_ADMIN') {
      return Response.json({ success: false, error: 'Access denied. Only Super Admins can modify user accounts.' }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    // Check email uniqueness if changing
    if (parsed.data.email && parsed.data.email !== existing.email) {
      const emailExists = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (emailExists) {
        return Response.json({ success: false, error: 'A user with this email already exists' }, { status: 400 });
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: parsed.data,
    });

    // R-09 (F-09): changing a user's email is an identity change on the
    // account — bump sessionVersion so existing sessions are rejected and
    // the user re-authenticates under the new identity.
    if (parsed.data.email && parsed.data.email !== existing.email) {
      await db.user.update({
        where: { id },
        data: { sessionVersion: { increment: 1 } },
      });
    }

    await createAuditLog({
      userId: user.userId,
      action: 'user.update',
      resource: 'User',
      resourceId: id,
      details: {
        before: { name: existing.name, email: existing.email },
        after: { name: updated.name, email: updated.email },
      },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        avatarUrl: updated.avatarUrl,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Update user error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Remove user
// ============================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!(await hasPlatformPermission(user.userId, user.role, 'platform:users:manage'))) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    // R-02 (F-02): deleting users is a SUPER_ADMIN-only operation, matching
    // the /api/master/users DELETE gate.
    if (normalizePlatformRole(user.role) !== 'SUPER_ADMIN') {
      return Response.json({ success: false, error: 'Access denied. Only Super Admins can delete users.' }, { status: 403 });
    }

    const { id } = await params;

    // Cannot delete self
    if (id === user.userId) {
      return Response.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // R-02 lockout guard: never delete the last active Super Admin.
    if (await isLastActiveSuperAdmin(id)) {
      return Response.json({ success: false, error: 'Cannot delete the last active Super Admin' }, { status: 400 });
    }

    await db.user.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: 'user.delete',
      resource: 'User',
      resourceId: id,
      details: { name: existing.name, email: existing.email },
      request,
    });

    return Response.json({ success: true, data: { id } });
  } catch (err) {
    console.error('Delete user error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}