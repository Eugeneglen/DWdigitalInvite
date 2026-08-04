import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { validatePassword } from '@/lib/password-policy';

/**
 * POST /api/auth/change-password
 *
 * Allows an authenticated user to change their password.
 * Two modes:
 *
 * 1. FORCED (mustChangePassword=true): The password was system-assigned.
 *    The "Current Password" field is optional — if omitted, the system-assigned
 *    password is accepted without verification. The user only needs to provide
 *    a new password that meets the policy.
 *
 * 2. VOLUNTARY (mustChangePassword=false): Standard password change.
 *    The user MUST provide their current password to prove identity.
 *
 * Body: { currentPassword?: string, newPassword: string }
 *
 * On success:
 *   - Updates the password hash
 *   - Sets mustChangePassword = false
 *   - Returns success
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!newPassword) {
      return NextResponse.json(
        { error: 'New password is required.' },
        { status: 400 },
      );
    }

    // Fetch the user
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordHash: true, mustChangePassword: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Verify current password — skip if this is a forced first-time change
    // (mustChangePassword=true) and the user left it blank. The password was
    // system-assigned, so the user may not know it.
    if (currentPassword) {
      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect.' },
          { status: 403 },
        );
      }
    } else if (!user.mustChangePassword) {
      // Voluntary change requires current password
      return NextResponse.json(
        { error: 'Current password is required.' },
        { status: 400 },
      );
    }

    // Validate new password against policy
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join('. ') },
        { status: 400 },
      );
    }

    // Hash and update
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Audit log
    try {
      await db.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entity: 'User',
          entityId: user.id,
          details: JSON.stringify({ action: 'PASSWORD_CHANGE', selfService: true }),
        },
      });
    } catch {
      // Audit log is non-critical
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
