import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear the session cookie
  response.cookies.set('next-auth.session-token', '', {
    httpOnly: true,
    secure: false, // Must match login cookie — Railway terminates TLS before app
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}