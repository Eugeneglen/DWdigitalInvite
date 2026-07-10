import type { NextAuthOptions } from 'next-auth';
import { getServerSession as _getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/db';

// ── Re-export getServerSession with our authOptions ──────────────────────────
export const getServerSession = () => _getServerSession(authOptions);

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
    // .env not readable — fail gracefully
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
    };
  }
  interface User {
    role: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
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
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  pages: {
    signIn: '/',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
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

// ── Feature keys & labels ───────────────────────────────────────────────────
export const FEATURE_KEYS = {
  RSVP: 'rsvp',
  WISHES: 'wishes',
  STORY: 'story',
  GALLERY: 'gallery',
  SCHEDULE: 'schedule',
  FAQ: 'faq',
  MOMENTS: 'moments',
  GETTING_THERE: 'getting-there',
  COUNTDOWN: 'countdown',
  MUSIC: 'music',
  VIDEO: 'video',
  QA: 'qa',
} as const;

export const FEATURE_LABELS: Record<string, string> = {
  rsvp: 'RSVP',
  wishes: 'Wishes',
  story: 'Our Story',
  gallery: 'Photo Gallery',
  schedule: 'Event Schedule',
  faq: 'FAQ',
  moments: 'Moments',
  'getting-there': 'Getting There',
  countdown: 'Countdown',
  music: 'Background Music',
  video: 'Video',
  qa: 'Q&A',
};

export const GLOBAL_FEATURE_LABELS: Record<string, string> = {
  ...FEATURE_LABELS,
};

// ── Role labels ─────────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ACCOUNT_MANAGER: 'Account Manager',
  COUPLE: 'Couple',
  ADMIN_1: 'Admin 1',
  ADMIN_2: 'Admin 2',
  ADMIN_3: 'Admin 3',
};

export const TENANT_ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};