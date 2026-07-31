import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import { resolveSecret } from '@/lib/auth';
import { normalizePlatformRole } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Access expiry check — if the user is a COUPLE, check if their wedding
    // account has expired. If so, block login with a clear message.
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

    // Create a NextAuth-compatible JWT using its own encode function.
    // IMPORTANT: Include both `sub` (NextAuth standard) and `id` (used by
    // the jwt callback in auth.ts to populate session.user.id).
    const token = await encode({
      token: {
        sub: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
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