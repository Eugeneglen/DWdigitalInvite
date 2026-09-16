import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog, authorizeTenantAccess } from '@/lib/auth-middleware';

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

    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:read' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
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
    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:members:invite' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
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
    let invitedTempPassword: string | null = null;

    if (!targetUser) {
      // R-05 (F-05/F-10): create the invited member's account with a
      // cryptographically generated temporary password (shown once to the
      // inviter in the response). The old hardcoded 'Editor@123' default is
      // removed — no predictable credentials. Forced change on first login.
      const { hashPassword } = await import('@/lib/auth');
      const { generateSecurePassword } = await import('@/lib/password-policy');
      const tempPassword = generateSecurePassword();
      const passwordHash = await hashPassword(tempPassword);
      targetUser = await db.user.create({
        data: {
          email: normalizedEmail,
          name,
          passwordHash,
          role: 'COUPLE', // Platform role COUPLE (routes to couple CMS)
          isActive: true,
          mustChangePassword: true,  // Force password change on first login
        },
      });
      invitedTempPassword = tempPassword;
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
        // R-05: one-time temporary credential for newly created member accounts
        // (null when the invited user already existed). Must be changed on first login.
        ...(invitedTempPassword ? { tempPassword: invitedTempPassword } : {}),
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
    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:members:remove' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
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

    // R-09 (F-09): removing a membership is a privilege reduction — bump
    // the removed user's sessionVersion so any existing session is rejected
    // and re-establishes authorization from scratch (defense-in-depth: the
    // member path in authorizeTenantAccess is an uncached per-request DB
    // lookup, so it would already deny access on the next request).
    await db.user.update({
      where: { id: member.userId },
      data: { sessionVersion: { increment: 1 } },
    }).catch(() => {
      // Non-critical: membership row is already gone; per-request membership
      // check denies access regardless.
    });

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
