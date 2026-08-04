import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';

// GET /api/master/content-templates/[id] — get full template data for editing
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:templates:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const template = await db.contentTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      isDefault: template.isDefault,
      isActive: template.isActive,
      sortOrder: template.sortOrder,
      content: JSON.parse(template.content),
      schedule: JSON.parse(template.schedule),
      faqs: JSON.parse(template.faqs),
      stories: JSON.parse(template.stories),
      media: JSON.parse(template.media),
      theme: JSON.parse(template.theme),
    });
  } catch (error) {
    console.error('Get content template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
