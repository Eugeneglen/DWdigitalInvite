import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — List content entries for a wedding (key-value WeddingContent model)
// ============================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:read');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have access to this wedding.' }, { status: 403 });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    // Optional section filter
    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    const where: Record<string, unknown> = { weddingId };
    if (section) {
      where.section = section;
    }

    const items = await db.weddingContent.findMany({
      where,
      orderBy: [{ section: 'asc' }, { fieldKey: 'asc' }],
    });

    return Response.json({
      success: true,
      data: items.map((item) => ({
        id: item.id,
        weddingId: item.weddingId,
        section: item.section,
        fieldKey: item.fieldKey,
        fieldValue: item.fieldValue,
        fieldType: item.fieldType,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List content blocks error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Create a new content entry
// ============================================

const createContentSchema = z.object({
  section: z.string().min(1, 'Section is required'),
  fieldKey: z.string().min(1, 'Field key is required'),
  fieldValue: z.string().min(1, 'Field value is required'),
  fieldType: z.enum(['TEXT', 'RICHTEXT', 'IMAGE_URL', 'JSON', 'NUMBER', 'BOOLEAN']).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:content:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit content.' }, { status: 403 });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createContentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { section, fieldKey, fieldValue, fieldType } = parsed.data;

    const item = await db.weddingContent.create({
      data: {
        weddingId,
        section,
        fieldKey,
        fieldValue,
        fieldType: fieldType ?? 'TEXT',
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: 'content.create',
      resource: 'WeddingContent',
      resourceId: item.id,
      weddingId,
      details: { section, fieldKey, fieldType: item.fieldType },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: item.id,
        weddingId: item.weddingId,
        section: item.section,
        fieldKey: item.fieldKey,
        fieldValue: item.fieldValue,
        fieldType: item.fieldType,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Create content block error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}