import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasPlatformPermission } from '@/lib/permissions';

// ============================================
// GET — List all users with owned weddings
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!hasPlatformPermission(user.role, 'platform:users:manage')) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        ownedWeddings: {
          select: { id: true, coupleName: true, slug: true },
        },
      },
    });

    return Response.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        avatarUrl: u.avatarUrl,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
        ownedWeddings: u.ownedWeddings.map((w) => ({
          id: w.id,
          coupleName: w.coupleName,
          slug: w.slug,
        })),
      })),
    });
  } catch (err) {
    console.error('List users error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Create user
// ============================================

const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required'),
  role: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    if (!hasPlatformPermission(user.role, 'platform:users:manage')) {
      return Response.json({ success: false, error: 'Access denied. Admin privileges required.' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email, password, name, role } = parsed.data;

    // Check if email already exists
    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return Response.json({ success: false, error: 'A user with this email already exists' }, { status: 400 });
    }

    const hashedPw = await hashPassword(password);

    const newUser = await db.user.create({
      data: {
        email,
        passwordHash: hashedPw,
        name,
        role: role || 'ADMIN_1',
      },
      include: {
        ownedWeddings: {
          select: { id: true, coupleName: true, slug: true },
        },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: 'user.create',
      resource: 'User',
      resourceId: newUser.id,
      details: { email, name, role: role || 'ADMIN_1' },
      request,
    });

    return Response.json(
      {
        success: true,
        data: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          avatarUrl: newUser.avatarUrl,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt.toISOString(),
          updatedAt: newUser.updatedAt.toISOString(),
          ownedWeddings: newUser.ownedWeddings.map((w) => ({
            id: w.id,
            coupleName: w.coupleName,
            slug: w.slug,
          })),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Create user error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}