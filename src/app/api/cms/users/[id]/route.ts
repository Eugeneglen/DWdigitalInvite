import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';

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

    const { id } = await params;

    // Cannot delete self
    if (id === user.userId) {
      return Response.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ success: false, error: 'User not found' }, { status: 404 });
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