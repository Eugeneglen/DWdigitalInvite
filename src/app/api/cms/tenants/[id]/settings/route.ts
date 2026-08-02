import { z } from 'zod';
import { db } from '@/lib/db';
import { authenticateRequest, createAuditLog } from '@/lib/auth-middleware';
import { hasWeddingPermission } from '@/lib/permissions';

// ============================================
// GET — Get wedding content as settings (key-value via WeddingContent)
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

    const account = await db.weddingAccount.findUnique({
      where: { id: weddingId },
      select: { id: true },
    });

    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const contentEntries = await db.weddingContent.findMany({
      where: { weddingId },
    });

    // Build a nested settings object: { section: { fieldKey: fieldValue } }
    const settings: Record<string, Record<string, unknown>> = {};
    for (const entry of contentEntries) {
      if (!settings[entry.section]) {
        settings[entry.section] = {};
      }
      try {
        settings[entry.section][entry.fieldKey] = JSON.parse(entry.fieldValue);
      } catch {
        settings[entry.section][entry.fieldKey] = entry.fieldValue;
      }
    }

    return Response.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    console.error('Get tenant settings error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// PUT — Replace settings (upsert WeddingContent entries)
// ============================================

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.record(z.string(), z.unknown())),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await authenticateRequest(request);
    if (error || !user) {
      return Response.json({ success: false, error: error || 'Authentication required' }, { status: 401 });
    }

    const { id: weddingId } = await params;

    const canAccess = await hasWeddingPermission(user.userId, user.role, weddingId, 'wedding:settings:write');
    if (!canAccess) {
      return Response.json({ success: false, error: 'Access denied. You do not have permission to edit wedding settings.' }, { status: 403 });
    }

    const account = await db.weddingAccount.findUnique({
      where: { id: weddingId },
      select: { id: true },
    });

    if (!account) {
      return Response.json({ success: false, error: 'Wedding account not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { settings } = parsed.data;

    // Upsert all content entries via transaction
    const upserts = Object.entries(settings).flatMap(([section, fields]) =>
      Object.entries(fields).map(([fieldKey, fieldValue]) =>
        db.weddingContent.upsert({
          where: {
            weddingId_section_fieldKey: { weddingId, section, fieldKey },
          },
          create: {
            weddingId,
            section,
            fieldKey,
            fieldValue: JSON.stringify(fieldValue),
          },
          update: {
            fieldValue: JSON.stringify(fieldValue),
          },
        })
      )
    );

    await db.$transaction(upserts);

    await createAuditLog({
      userId: user.userId,
      action: 'tenant.settings.update',
      resource: 'WeddingAccount',
      resourceId: weddingId,
      weddingId,
      details: {
        after: settings,
      },
      request,
    });

    return Response.json({
      success: true,
      data: settings,
    });
  } catch (err) {
    console.error('Update tenant settings error:', err);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}