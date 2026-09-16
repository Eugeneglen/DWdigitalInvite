import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { getServerSession, resolveSecret } from '@/lib/auth';
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

    // Hash and update.
    // R-09 (F-09): bumping sessionVersion revokes EVERY issued session for
    // this user (other browsers/devices included). The actor's own cookie is
    // rotated below with the new version, so the user who changed the
    // password keeps working while all other sessions die.
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        resetToken: null,
        resetTokenExpiry: null,
        sessionVersion: { increment: 1 },
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
          details: JSON.stringify({ action: 'PASSWORD_CHANGE', selfService: true, sessionsRevoked: true }),
        },
      });
    } catch {
      // Audit log is non-critical
    }

    // ── R-09: rotate the actor's session cookie onto the new version ──────
    // Mirrors the token shape minted by /api/auth/login (including `sv`),
    // so the current browser continues seamlessly while every other
    // session for this user is rejected from its next request onwards.
    const response = NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
    });
    try {
      const rotatedToken = await encode({
        token: {
          sub: user.id,
          id: user.id,
          name: session.user.name,
          email: session.user.email,
          role: updatedUser.role,
          mustChangePassword: false,
          sv: updatedUser.sessionVersion,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        },
        secret: resolveSecret() || '',
      });
      response.cookies.set('next-auth.session-token', rotatedToken, {
        httpOnly: true,
        secure: false, // Must match login cookie — Railway terminates TLS before app
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
      });
    } catch (rotationError) {
      // Rotation is best-effort: if it fails, the version bump already
      // revoked all sessions (fail-closed) and the user simply re-logs in.
      console.error('Session rotation after password change failed:', rotationError);
    }

    return response;
  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
