import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getServerSession as nextAuthGetServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';
import {
  checkLoginAllowed,
  equalizeLoginTiming,
  extractClientIp,
  logLoginEvent,
  normalizeLoginIdentifier,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/login-security';

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
    /** R-09: current session revocation version, embedded as `sv` in the JWT. */
    sessionVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    mustChangePassword?: boolean;
    /** R-09: session version snapshot taken at login. Compared against
     *  User.sessionVersion on every session read — mismatch ⇒ revoked. */
    sv?: number;
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
      // NextAuth passes { query, body, headers, method } as the second
      // argument (plain object, not a Headers instance).
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const normalizedEmail = normalizeLoginIdentifier(credentials.email);
        const ip = extractClientIp((req as { headers?: Record<string, unknown> } | undefined)?.headers);
        const userAgent =
          (req as { headers?: Record<string, string> } | undefined)?.headers?.['user-agent'] ?? null;

        // ── R-08 (F-08): brute-force gate, BEFORE any credential evaluation.
        const gate = checkLoginAllowed(normalizedEmail, ip);
        if (!gate.allowed) {
          await logLoginEvent({
            event: 'LOGIN_THROTTLED',
            userId: null,
            attemptedEmail: normalizedEmail,
            ip,
            userAgent,
          });
          // NextAuth cannot surface a 429 from authorize(); returning null
          // yields the same generic CredentialsSignin error as a wrong
          // password. The attempt is still blocked and audited.
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: normalizedEmail },
        });

        // ── R-08: uniform failure handling. Unknown account and inactive
        // account run a decoy bcrypt compare so response timing matches the
        // wrong-password path (no account-enumeration via timing), and every
        // failure feeds the account+IP throttles.
        if (!user) {
          await equalizeLoginTiming(credentials.password);
          recordLoginFailure(normalizedEmail, ip, 'ACCOUNT_NOT_FOUND');
          await logLoginEvent({
            event: 'LOGIN_FAILED_ACCOUNT_NOT_FOUND',
            userId: null,
            attemptedEmail: normalizedEmail,
            ip,
            userAgent,
          });
          return null;
        }

        if (!user.isActive) {
          await equalizeLoginTiming(credentials.password);
          recordLoginFailure(normalizedEmail, ip, 'ACCOUNT_INACTIVE');
          await logLoginEvent({
            event: 'LOGIN_FAILED_ACCOUNT_INACTIVE',
            userId: user.id,
            attemptedEmail: normalizedEmail,
            ip,
            userAgent,
          });
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          recordLoginFailure(normalizedEmail, ip, 'WRONG_PASSWORD');
          await logLoginEvent({
            event: 'LOGIN_FAILED_WRONG_PASSWORD',
            userId: user.id,
            attemptedEmail: normalizedEmail,
            ip,
            userAgent,
          });
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

        recordLoginSuccess(normalizedEmail);
        await logLoginEvent({
          event: 'LOGIN_SUCCESS',
          userId: user.id,
          attemptedEmail: normalizedEmail,
          ip,
          userAgent,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          sessionVersion: user.sessionVersion,
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
        // R-09: snapshot the current session version into the token.
        token.sv = user.sessionVersion ?? 0;
      } else if (token.id) {
        // On session refresh — re-read the security-relevant user state from
        // the database. This callback runs on EVERY getServerSession() call,
        // which is what makes revocation immediate rather than token-lifetime.
        //
        // R-09 (F-09) fail-closed revocation check:
        //   - user deleted                  → dead token
        //   - user deactivated (isActive)   → dead token
        //   - sessionVersion mismatch       → dead token (password change /
        //     reset, deactivation or privilege reduction since issuance)
        // A dead token is `{}`; the session callback then yields an empty
        // body, which getServerSession() surfaces as `null` (no session).
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id },
            select: {
              mustChangePassword: true,
              role: true,
              isActive: true,
              sessionVersion: true,
            },
          });
          if (
            !dbUser ||
            !dbUser.isActive ||
            token.sv !== dbUser.sessionVersion
          ) {
            // Dead token: a JWT with no subject. The cast is required only
            // because NextAuth's callback types don't model revocation —
            // runtime-wise an empty object is a valid (subject-less) JWT,
            // and the session callback below turns it into "no session".
            return {} as JWT;
          }
          token.mustChangePassword = dbUser.mustChangePassword;
          token.role = dbUser.role;
          token.sv = dbUser.sessionVersion;
        } catch {
          // DB read failed — fail closed: a session we cannot verify is a
          // session we must not honour.
          return {} as JWT;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // R-09: dead/empty tokens produce an empty session body. NextAuth's
      // getServerSession() returns `null` for an empty body, so every
      // consumer sees "not authenticated" and fails closed. (The cast is
      // needed only because NextAuth's types don't model an empty session.)
      if (!token?.id) {
        return {} as Session;
      }
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