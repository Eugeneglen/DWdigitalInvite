import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession as nextAuthGetServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

// ── getServerSession wrapper ──────────────────────────────────────────────
// Re-exports NextAuth's built-in getServerSession with authOptions pre-bound.
// SECURITY: No hardcoded secret literals. Secret is resolved exclusively
// from process.env (NEXTAUTH_SECRET / JWT_SECRET) with a .env file fallback
// for local Turbopack dev only.
export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

// ── JWT Payload type ────────────────────────────────────────────────────────
export interface JWTPayload {
  userId: string;
  email: string;
  name?: string;
  role: string;
  tenantId?: string;
  tenantRole?: string;
  iat?: number;
  exp?: number;
}

// ── Token utilities ─────────────────────────────────────────────────────────
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = resolveSecret();
    if (!secret) return null;
    return jwt.verify(token, secret) as JWTPayload;
  } catch {
    return null;
  }
}

export function getIpAddress(request: Request): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent') || null;
}

// ── Robust secret resolution ────────────────────────────────────────────────
// Turbopack route handlers sometimes don't receive process.env from .env.
// This fallback reads the .env file directly to guarantee the secret is available.
// In non-production, if all sources fail, generates a dev secret so the app
// never crashes with "ikm must be at least one byte in length".
let _devSecret: string | undefined;

export function resolveSecret(): string | undefined {
  // 1. Try process.env (normal Next.js behavior)
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  // 2. Fallback: read .env file directly
  try {
    const envPath = path.join(process.cwd(), '.env');
    const content = readFileSync(envPath, 'utf-8');
    const match = content.match(/^NEXTAUTH_SECRET=(.+)$/m);
    if (match?.[1]?.trim()) return match[1].trim();
    const jwtMatch = content.match(/^JWT_SECRET=(.+)$/m);
    if (jwtMatch?.[1]?.trim()) return jwtMatch[1].trim();
  } catch {
    // .env not readable — continue to dev fallback
  }

  // 3. Dev-only fallback: generate a persistent random secret so the app
  //    works even when the sandbox wipes .env. Deterministic per process
  //    so sessions survive within the same dev server run.
  //    NEVER reached in production (Railway sets NEXTAUTH_SECRET in env vars).
  if (process.env.NODE_ENV !== 'production') {
    if (!_devSecret) {
      _devSecret = 'dev-local-secret-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      console.warn('[auth] NEXTAUTH_SECRET not found — using dev fallback. Sessions will break on server restart. Fix: add NEXTAUTH_SECRET to .env');
    }
    return _devSecret;
  }

  return undefined;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      mustChangePassword?: boolean;
    };
  }
  interface User {
    role: string;
    mustChangePassword?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    mustChangePassword?: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const normalizedEmail = credentials.email.trim().toLowerCase();

        const user = await db.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          return null;
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  // Railway's proxy terminates TLS, so the app sees HTTP internally.
  // NextAuth sets 'Secure' cookies by default in production, which won't
  // be sent back over the internal HTTP connection. Override to non-secure.
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  pages: {
    signIn: '/',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // On fresh login — set from the user object
        token.id = user.id!;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
      } else if (token.id) {
        // On session refresh — re-read mustChangePassword from DB
        // This ensures the flag is always current, even if the JWT is stale
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id },
            select: { mustChangePassword: true, role: true },
          });
          if (dbUser) {
            token.mustChangePassword = dbUser.mustChangePassword;
            token.role = dbUser.role;
          }
        } catch {
          // DB read failed — keep the existing token values
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.mustChangePassword = token.mustChangePassword;
      }
      return session;
    },
  },
  secret: resolveSecret(),
};

// ── Password hashing ────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// ── Re-export constants from the client-safe module ───────────────────────
export { FEATURE_KEYS, FEATURE_LABELS, GLOBAL_FEATURE_LABELS, ROLE_LABELS, TENANT_ROLE_LABELS } from '@/lib/constants';