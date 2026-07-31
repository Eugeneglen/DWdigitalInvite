import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';
import { z } from 'zod/v4';

// ── POST /api/master/users/[id]/reset-password — reset a user's password ──

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:users:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { newPassword } = parsed.data;
    const passwordHash = await hashPassword(newPassword);

    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        mustChangePassword: true,  // Force password change on next login after admin reset
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: userId,
        details: JSON.stringify({ action: 'PASSWORD_RESET', targetEmail: user.email }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Password reset for ${user.email}`,
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
