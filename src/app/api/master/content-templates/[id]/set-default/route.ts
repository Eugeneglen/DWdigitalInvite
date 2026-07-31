import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';

// POST /api/master/content-templates/[id]/set-default
// Sets this template as the default (unsets all others)
export async function POST(
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
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    if (!template.isActive) {
      return NextResponse.json({ error: 'Cannot set an inactive template as default' }, { status: 400 });
    }

    // Unset all other defaults, then set this one
    await db.contentTemplate.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    await db.contentTemplate.update({
      where: { id },
      data: { isDefault: true },
    });

    return NextResponse.json({ success: true, message: `${template.name} is now the default template` });
  } catch (error) {
    console.error('Set default template error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
