import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from '@/lib/auth';
import { DEFAULT_TEMPLATES } from '@/lib/wedding-templates';

// GET /api/cms/templates — returns the active admin templates for the couple's Design page.
// Read-only: couples can browse and apply, but not edit the templates themselves.
// DEFAULT_TEMPLATES is imported from the shared single-source-of-truth file
// so admin and couple always see identical palettes.
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load any admin overrides from SystemSetting
    const settings = await db.systemSetting.findMany({
      where: {
        OR: [
          { key: { startsWith: 'template_' } },
          { key: 'default_template' },
        ],
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const defaultId = settingsMap['default_template'] || 'classic-elegance';

    // Rebuild templates from defaults + persisted overrides (same logic as MasterTemplates.tsx)
    const templates = DEFAULT_TEMPLATES.map((def) => {
      const stored = settingsMap[`template_${def.id}`];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return { ...def, ...parsed, isDefault: def.id === defaultId };
        } catch {
          return { ...def, isDefault: def.id === defaultId };
        }
      }
      return { ...def, isDefault: def.id === defaultId };
    });

    // Only return active templates to couples
    const activeTemplates = templates.filter((t) => t.isActive);

    return NextResponse.json({ templates: activeTemplates });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
