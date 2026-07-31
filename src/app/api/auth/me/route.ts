import { getServerSession } from '@/lib/auth';
import { normalizePlatformRole } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user) {
      return Response.json(
        { success: false, error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // Look up the wedding account owned by this user (for couple users)
    let weddingId: string | undefined;
    if (normalizePlatformRole(session.user.role) === 'COUPLE') {
      const { db } = await import('@/lib/db');
      const wedding = await db.weddingAccount.findFirst({
        where: { ownerId: session.user.id },
        select: { id: true },
      });
      weddingId = wedding?.id;
    }

    return Response.json({
      success: true,
      user: {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        tenantId: weddingId,
      },
    });
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}