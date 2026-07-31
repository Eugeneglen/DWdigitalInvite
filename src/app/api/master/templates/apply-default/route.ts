import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { hasPlatformPermission } from '@/lib/permissions';
import { DEFAULT_TEMPLATES } from '@/lib/wedding-templates';

// POST /api/master/templates/apply-default
// SUPER_ADMIN bulk action: writes the global default template's colors + fonts
// into WeddingContent (section `global`) for every wedding whose
// `themeCustomized` flag is still false. Couples who have manually customized
// their theme (via the Home page pickers or by applying a template on the
// Design page) are protected.
export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:templates:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the default template (same logic as MasterTemplates.tsx + /api/cms/templates)
    const settings = await db.systemSetting.findMany({
      where: { OR: [{ key: { startsWith: 'template_' } }, { key: 'default_template' }] },
    });
    const settingsMap: Record<string, string> = {};
    settings.forEach((s) => (settingsMap[s.key] = s.value));
    const defaultId = settingsMap['default_template'] || 'classic-elegance';

    let template = DEFAULT_TEMPLATES.find((t) => t.id === defaultId) ?? DEFAULT_TEMPLATES[0];
    const stored = settingsMap[`template_${defaultId}`];
    if (stored) {
      try {
        template = { ...template, ...JSON.parse(stored) };
      } catch {
        /* ignore malformed JSON, fall back to hardcoded default */
      }
    }

    // Find all non-customized weddings
    const weddings = await db.weddingAccount.findMany({
      where: { themeCustomized: false },
      select: { id: true },
    });

    const items = [
      { section: 'global', fieldKey: 'backgroundColor', fieldValue: template.colors.bg, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'textColor', fieldValue: template.colors.text, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'accentColor', fieldValue: template.colors.accent, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'secondaryColor', fieldValue: template.colors.secondary, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'mutedColor', fieldValue: template.colors.muted, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'fontFamily', fieldValue: template.fonts.heading, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'bodyFont', fieldValue: template.fonts.body, fieldType: 'TEXT' },
      { section: 'hero', fieldKey: 'fontFamily', fieldValue: template.fonts.heading, fieldType: 'TEXT' },
    ];

    let updatedCount = 0;
    for (const w of weddings) {
      for (const item of items) {
        await db.weddingContent.upsert({
          where: { weddingId_section_fieldKey: { weddingId: w.id, section: item.section, fieldKey: item.fieldKey } },
          update: { fieldValue: item.fieldValue },
          create: { weddingId: w.id, ...item },
        });
      }
      updatedCount++;
    }

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'WeddingAccount',
        details: JSON.stringify({
          bulkAction: 'apply-default-template',
          templateId: template.id,
          templateName: template.name,
          updatedCount,
        }),
      },
    });

    return NextResponse.json({ success: true, updatedCount, templateName: template.name });
  } catch (error) {
    console.error('Apply default error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
