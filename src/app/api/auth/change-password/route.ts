import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { validatePassword } from '@/lib/password-policy';

/**
 * POST /api/auth/change-password
 *
 * Allows an authenticated user to change their password.
 * Used for the "first-time login password change" flow — when
 * mustChangePassword is true, the user is forced to call this endpoint
 * before they can access the CMS.
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Validates:
 *   - currentPassword matches the stored hash
 *   - newPassword meets the market gold standard policy
 *     (min 8, upper, lower, number, special)
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

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required.' },
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

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 403 },
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
