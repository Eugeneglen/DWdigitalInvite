import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { resolveSecret } from '@/lib/auth';
import { normalizePlatformRole } from '@/lib/permissions';
import {
  checkLoginAllowed,
  equalizeLoginTiming,
  logLoginEvent,
  normalizeLoginIdentifier,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-security';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // ── R-08 (F-08): brute-force gate BEFORE any credential evaluation.
    // Account key uses the normalized attempted email (existence-agnostic),
    // plus a separate IP key — see src/lib/login-security.ts for the policy.
    const normalizedEmail = normalizeLoginIdentifier(String(email));
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = request.headers.get('user-agent');

    const gate = checkLoginAllowed(normalizedEmail, ip);
    if (!gate.allowed) {
      await logLoginEvent({
        event: 'LOGIN_THROTTLED',
        userId: null,
        attemptedEmail: normalizedEmail,
        ip,
        userAgent,
      });
      return NextResponse.json(
        { error: 'Too many attempts. Please wait and try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(gate.retryAfterSec ?? 30) },
        },
      );
    }

    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    // ── R-08: uniform failure handling — unknown account and inactive
    // account run a decoy bcrypt compare so response timing matches the
    // wrong-password path (no account enumeration via timing), and every
    // failure feeds the account+IP throttles.
    if (!user) {
      await equalizeLoginTiming(String(password));
      recordLoginFailure(normalizedEmail, ip, 'ACCOUNT_NOT_FOUND');
      await logLoginEvent({
        event: 'LOGIN_FAILED_ACCOUNT_NOT_FOUND',
        userId: null,
        attemptedEmail: normalizedEmail,
        ip,
        userAgent,
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.isActive) {
      await equalizeLoginTiming(String(password));
      recordLoginFailure(normalizedEmail, ip, 'ACCOUNT_INACTIVE');
      await logLoginEvent({
        event: 'LOGIN_FAILED_ACCOUNT_INACTIVE',
        userId: user.id,
        attemptedEmail: normalizedEmail,
        ip,
        userAgent,
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(String(password), user.passwordHash);
    if (!isValid) {
      recordLoginFailure(normalizedEmail, ip, 'WRONG_PASSWORD');
      await logLoginEvent({
        event: 'LOGIN_FAILED_WRONG_PASSWORD',
        userId: user.id,
        attemptedEmail: normalizedEmail,
        ip,
        userAgent,
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Access expiry check — if the user is a COUPLE, check if their wedding
    // account has expired. If so, block login with a clear message.
    // (Post-authentication — does not enable account enumeration.)
    if (normalizePlatformRole(user.role) === 'COUPLE') {
      const wedding = await db.weddingAccount.findFirst({
        where: { ownerId: user.id },
        select: { accountStatus: true, accessExpiryDate: true },
      });
      if (wedding?.accountStatus === 'EXPIRED') {
        return NextResponse.json(
          { error: 'Your access has expired. Please contact DreamWeavers to extend your access.' },
          { status: 403 },
        );
      }
      // Auto-expire: if accessExpiryDate has passed, update status and block
      if (wedding?.accessExpiryDate && new Date() > wedding.accessExpiryDate && wedding.accountStatus !== 'EXPIRED') {
        await db.weddingAccount.updateMany({
          where: { ownerId: user.id },
          data: { accountStatus: 'EXPIRED' },
        });
        return NextResponse.json(
          { error: 'Your access has expired. Please contact DreamWeavers to extend your access.' },
          { status: 403 },
        );
      }
      // Auto-complete: if wedding date has passed, update status
      if (wedding && wedding.accountStatus === 'ACTIVE') {
        const weddingAccount = await db.weddingAccount.findFirst({
          where: { ownerId: user.id },
          select: { weddingDate: true },
        });
        if (weddingAccount && new Date() > new Date(weddingAccount.weddingDate.getTime() + 24 * 60 * 60 * 1000)) {
          await db.weddingAccount.updateMany({
            where: { ownerId: user.id },
            data: { accountStatus: 'COMPLETED' },
          });
        }
      }
    }

    // Update last login (non-critical — don't block login on write failure)
    try {
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      // Ignore — DB may be read-only in some environments
    }

    recordLoginSuccess(normalizedEmail);
    await logLoginEvent({
      event: 'LOGIN_SUCCESS',
      userId: user.id,
      attemptedEmail: normalizedEmail,
      ip,
      userAgent,
    });

    // Create a NextAuth-compatible JWT using its own encode function.
    // IMPORTANT: Include both `sub` (NextAuth standard) and `id` (used by
    // the jwt callback in auth.ts to populate session.user.id).
    // R-09: embed the user's current sessionVersion as `sv` so the jwt
    // callback can reject the token after password change/reset,
    // deactivation or privilege reduction.
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        sv: user.sessionVersion,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      },
      secret: resolveSecret() || '',
    });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      mustChangePassword: user.mustChangePassword,
    });

    response.cookies.set('next-auth.session-token', token, {
      httpOnly: true,
      // Railway's proxy terminates TLS, so the app sees HTTP internally.
      // A 'Secure' cookie wouldn't be sent back over the internal HTTP
      // connection, causing auth failures. Set to false for Railway compat.
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
