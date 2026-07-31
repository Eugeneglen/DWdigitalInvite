import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — List all members (UserWeddingRole) for a wedding
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:read');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have access to this wedding.' }, { status: 403 });
    }

    const members = await db.userWeddingRole.findMany({
      where: { weddingId },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Response.json({
      success: true,
      data: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        isActive: m.user.isActive,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List members error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Invite a new member (EDITOR or VIEWER) to the wedding
// Only COUPLE or CONSULTANT_1 can invite
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    // Only COUPLE or CONSULTANT_1 can invite members
    const canInvite = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:members:invite');
    if (!canInvite) {
      return Response.json({ success: false, error: 'Access denied. Only the couple or senior consultant can invite team members.' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, role } = body as { email: string; name: string; role: string };

    // Validate role — only EDITOR or VIEWER can be invited (not COUPLE/CONSULTANT/COORDINATOR)
    if (role !== 'EDITOR' && role !== 'VIEWER') {
      return Response.json({ success: false, error: 'Invalid role. Only EDITOR or VIEWER can be invited.' }, { status: 400 });
    }

    if (!email || !name) {
      return Response.json({ success: false, error: 'Email and name are required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    let targetUser = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!targetUser) {
      // Create a new user account with a default password
      // The invited user can change it later
      const { hashPassword } = await import('@/lib/auth');
      const defaultPassword = 'Editor@123';
      const passwordHash = await hashPassword(defaultPassword);
      targetUser = await db.user.create({
        data: {
          email: normalizedEmail,
          name,
          passwordHash,
          role: 'COUPLE', // Platform role COUPLE (routes to couple CMS)
          isActive: true,
        },
      });
    }

    // Check if the role assignment already exists
    const existing = await db.userWeddingRole.findFirst({
      where: { userId: targetUser.id, weddingId, role },
    });

    if (existing) {
      return Response.json({ success: false, error: 'This user already has that role on this wedding.' }, { status: 409 });
    }

    // Create the UserWeddingRole
    const member = await db.userWeddingRole.create({
      data: { userId: targetUser.id, weddingId, role },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
      },
    });

    // Audit log
    await createAuditLog({
      userId: user.userId,
      action: 'CREATE',
      resource: 'UserWeddingRole',
      resourceId: member.id,
      weddingId,
      details: { invitedEmail: normalizedEmail, role, invitedBy: user.email },
    });

    return Response.json({
      success: true,
      data: {
        id: member.id,
        userId: member.userId,
        role: member.role,
        email: member.user.email,
        name: member.user.name,
        avatarUrl: member.user.avatarUrl,
        isActive: member.user.isActive,
        createdAt: member.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (err) {
    console.error('Invite member error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// DELETE — Remove a member from the wedding
// Only COUPLE or CONSULTANT_1 can remove members
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    // Only COUPLE or CONSULTANT_1 can remove members
    const canRemove = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:members:remove');
    if (!canRemove) {
      return Response.json({ success: false, error: 'Access denied. Only the couple or senior consultant can remove team members.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return Response.json({ success: false, error: 'Member ID required.' }, { status: 400 });
    }

    // Find the member role
    const member = await db.userWeddingRole.findFirst({
      where: { id: memberId, weddingId },
    });

    if (!member) {
      return Response.json({ success: false, error: 'Member not found.' }, { status: 404 });
    }

    // Cannot remove a COUPLE role (the owner)
    if (member.role === 'COUPLE') {
      return Response.json({ success: false, error: 'Cannot remove the wedding owner.' }, { status: 400 });
    }

    await db.userWeddingRole.delete({ where: { id: memberId } });

    // Audit log
    await createAuditLog({
      userId: user.userId,
      action: 'DELETE',
      resource: 'UserWeddingRole',
      resourceId: memberId,
      weddingId,
      details: { removedUserId: member.userId, removedRole: member.role, removedBy: user.email },
    });

    return Response.json({ success: true });
  } catch (err) {
    console.error('Remove member error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
