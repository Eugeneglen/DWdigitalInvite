import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email-service';

/**
 * POST /api/auth/forgot-password
 * Body: { email: string }
 *
 * Generates a reset token, stores it on the user record, and sends a
 * password-reset email containing a link to /reset-password?token=<token>.
 *
 * Security: Always returns 200 with the same message regardless of whether
 * the account exists, to prevent user-enumeration attacks.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user || !user.isActive) {
      // Don't reveal whether the account exists
      return NextResponse.json({
        message:
          'If an account with that email exists, a password reset link has been sent to your inbox.',
      });
    }

    // Generate a secure random token (hex, 32 bytes = 64 chars)
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await db.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    // ── Email dispatch ───────────────────────────────────────────────
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const userName = user.name || user.email;

    try {
      await sendEmail({
        to: user.email,
        subject: 'DreamWeavers — Password Reset',
        html: `
          <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; background: #FCF9F2; padding: 40px; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1A1A1A; font-size: 24px; margin: 0;">DreamWeavers</h1>
              <p style="color: #D4AF37; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin: 5px 0 0 0;">Digital Wedding Invitations</p>
            </div>
            <h2 style="color: #1A1A1A; font-size: 20px;">Password Reset Request</h2>
            <p style="color: #555; line-height: 1.6;">Hi ${userName},</p>
            <p style="color: #555; line-height: 1.6;">We received a request to reset your password. Click the link below to set a new password:</p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #D4AF37; color: #1A1A1A; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">Reset Password</a>
            </div>
            <p style="color: #999; font-size: 12px;">This link expires in 30 minutes. If you did not request this, you can safely ignore this email.</p>
            <p style="color: #555; line-height: 1.6;">Warm regards,<br>The DreamWeavers Team</p>
          </div>
        `,
        text: `Hi ${userName},\n\nWe received a request to reset your password. Click the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in 30 minutes. If you did not request this, you can safely ignore this email.\n\nWarm regards,\nThe DreamWeavers Team`,
      }, 'password_reset');
    } catch (emailError) {
      console.error('[forgot-password] Email send failed (non-blocking):', emailError);
    }

    return NextResponse.json({
      message:
        'If an account with that email exists, a password reset link has been sent to your inbox.',
    });
  } catch (error) {
    console.error('[forgot-password] Error:', error);
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}