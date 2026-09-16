import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog, authorizeTenantAccess } from '@/lib/auth-middleware';

// ============================================
// GET — List media items for a wedding (with optional category filter)
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

    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:read' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    // Parse optional category query param
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: Record<string, unknown> = { weddingId };
    if (category) {
      where.category = category;
    }

    const items = await db.weddingMedia.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return Response.json({
      success: true,
      data: items.map((item) => ({
        id: item.id,
        weddingId: item.weddingId,
        category: item.category,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSize,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List media items error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Create a new media item
// ============================================

const createMediaSchema = z.object({
  url: z.string().min(1, 'URL is required'),
  thumbnailUrl: z.string().optional(),
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().default('IMAGE'),
  fileSize: z.number().int().optional(),
  category: z.string().default('gallery'),
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

    // R-03 (F-03) tenant guard: authenticate → resolve wedding → platform/owner/member → permission
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:media:write' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createMediaSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { url, thumbnailUrl, fileName, fileType, fileSize, category } = parsed.data;

    // Auto-assign sortOrder = max existing sortOrder + 1
    const maxSortOrder = await db.weddingMedia.findFirst({
      where: { weddingId, category },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const sortOrder = (maxSortOrder?.sortOrder ?? -1) + 1;

    const item = await db.weddingMedia.create({
      data: {
        weddingId,
        url,
        thumbnailUrl: thumbnailUrl ?? null,
        fileName,
        fileType,
        fileSize: fileSize ?? null,
        category,
        sortOrder,
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: 'media.create',
      resource: 'WeddingMedia',
      resourceId: item.id,
      weddingId,
      details: { category, fileName, sortOrder },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: item.id,
        weddingId: item.weddingId,
        category: item.category,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        fileName: item.fileName,
        fileType: item.fileType,
        fileSize: item.fileSize,
        sortOrder: item.sortOrder,
        createdAt: item.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Create media item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}