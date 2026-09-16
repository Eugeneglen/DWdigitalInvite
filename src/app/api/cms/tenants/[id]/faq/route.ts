import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog, authorizeTenantAccess } from '@/lib/auth-middleware';

// ============================================
// GET — List all FAQ items for a wedding
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

    const items = await db.fAQ.findMany({
      where: { weddingId },
      orderBy: { sortOrder: 'asc' },
    });

    return Response.json({
      success: true,
      data: items.map((item) => ({
        id: item.id,
        weddingId: item.weddingId,
        question: item.question,
        answer: item.answer,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('List FAQ items error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// POST — Create a new FAQ item
// ============================================

const createFaqSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  answer: z.string().min(1, 'Answer is required'),
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
    const guard = await authorizeTenantAccess(user, weddingId, { platformPerm: 'platform:weddings:read', weddingAction: 'wedding:content:write' });
    if (!guard.ok) {
      return Response.json({ success: false, error: guard.error }, { status: guard.status });
    }

    // Verify wedding account exists
    const account = await db.weddingAccount.findUnique({ where: { id: weddingId } });
    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createFaqSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { question, answer } = parsed.data;

    // Auto-assign sortOrder = max existing sortOrder + 1
    const maxSortOrder = await db.fAQ.findFirst({
      where: { weddingId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const sortOrder = (maxSortOrder?.sortOrder ?? -1) + 1;

    const item = await db.fAQ.create({
      data: {
        weddingId,
        question,
        answer,
        sortOrder,
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: 'faq.create',
      resource: 'FAQ',
      resourceId: item.id,
      weddingId,
      details: { question, sortOrder },
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: item.id,
        weddingId: item.weddingId,
        question: item.question,
        answer: item.answer,
        sortOrder: item.sortOrder,
        isActive: item.isActive,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error('Create FAQ item error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}