import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Role prefixes that grant admin access
const ADMIN_ROLE_PREFIXES = ['SUPER_ADMIN', 'CONSULTANT', 'SUPPORT'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* and /workspace/* routes
  const isAdmin = pathname.startsWith('/admin');
  const isWorkspace = pathname.startsWith('/workspace');

  if (!isAdmin && !isWorkspace) return NextResponse.next();

  // Read NEXTAUTH_SECRET directly from env (Edge Runtime compatible —
  // cannot import @/lib/auth which uses Node.js fs/path/process.cwd APIs)
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return NextResponse.next(); // Let the page handle missing secret

  const token = await getToken({
    req: request,
    secret,
    cookieName: 'next-auth.session-token',
  });

  if (!token) {
    const loginUrl = new URL('/?view=cms', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // For /admin/* routes, verify the user has an admin-level role
  if (isAdmin) {
    const role = (token.role as string) || '';
    const hasAdminRole = ADMIN_ROLE_PREFIXES.some((prefix) =>
      role.toUpperCase().startsWith(prefix)
    );

    if (!hasAdminRole) {
      // Non-admin users get redirected to workspace or home
      const redirectUrl = new URL('/?view=couple', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/workspace/:path*'],
};
