import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';
import { z } from 'zod/v4';

// GET /api/master/content-templates — list all content templates
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:templates:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await db.contentTemplate.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        isDefault: t.isDefault,
        isActive: t.isActive,
        sortOrder: t.sortOrder,
        contentCount: JSON.parse(t.content).length,
        scheduleCount: JSON.parse(t.schedule).length,
        faqCount: JSON.parse(t.faqs).length,
        storyCount: JSON.parse(t.stories).length,
        mediaCount: JSON.parse(t.media).length,
        theme: JSON.parse(t.theme),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Content templates list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/master/content-templates — create a new template
// Body: { name, description?, cloneFromWeddingId? }
// If cloneFromWeddingId is provided, extracts content from that wedding
const createTemplateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  cloneFromWeddingId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:templates:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, description, cloneFromWeddingId } = parsed.data;

    // Check name uniqueness
    const existing = await db.contentTemplate.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
    }

    let contentData: string;
    let scheduleData: string;
    let faqsData: string;
    let storiesData: string;
    let mediaData: string;
    let themeData: string;

    if (cloneFromWeddingId) {
      // Clone from an existing wedding
      const wedding = await db.weddingAccount.findUnique({ where: { id: cloneFromWeddingId } });
      if (!wedding) {
        return NextResponse.json({ error: 'Wedding not found' }, { status: 404 });
      }

      const contentItems = await db.weddingContent.findMany({
        where: { weddingId: cloneFromWeddingId },
        select: { section: true, fieldKey: true, fieldValue: true, fieldType: true },
        orderBy: [{ section: 'asc' }, { fieldKey: 'asc' }],
      });
      // Replace base64 with placeholder
      const contentCleaned = contentItems.map((item) => ({
        ...item,
        fieldValue: item.fieldValue?.startsWith('data:')
          ? '/wedding-images/hero-portrait.png'
          : item.fieldValue,
      }));

      const scheduleItems = await db.eventSchedule.findMany({
        where: { weddingId: cloneFromWeddingId },
        select: { eventType: true, title: true, description: true, startTime: true, endTime: true, location: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      });

      const faqItems = await db.fAQ.findMany({
        where: { weddingId: cloneFromWeddingId },
        select: { question: true, answer: true, sortOrder: true, isActive: true },
        orderBy: { sortOrder: 'asc' },
      });

      const storyItems = await db.storyItem.findMany({
        where: { weddingId: cloneFromWeddingId },
        select: { title: true, content: true, date: true, imageUrl: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      });
      const storiesCleaned = storyItems.map((item) => ({
        ...item,
        imageUrl: item.imageUrl?.startsWith('data:') ? '/wedding-images/story-hero.png' : item.imageUrl,
      }));

      const mediaItems = await db.weddingMedia.findMany({
        where: { weddingId: cloneFromWeddingId },
        select: { url: true, thumbnailUrl: true, fileName: true, fileType: true, category: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      });
      const mediaCleaned = mediaItems.map((item) => ({
        ...item,
        url: item.url?.startsWith('data:') ? '/wedding-images/gallery-1.png' : item.url,
        thumbnailUrl: item.thumbnailUrl?.startsWith('data:') ? '/wedding-images/gallery-1.png' : item.thumbnailUrl,
      }));

      contentData = JSON.stringify(contentCleaned);
      scheduleData = JSON.stringify(scheduleItems);
      faqsData = JSON.stringify(faqItems);
      storiesData = JSON.stringify(storiesCleaned);
      mediaData = JSON.stringify(mediaCleaned);
      themeData = JSON.stringify({
        colors: { bg: '#FDF8F0', text: '#2C2C2C', accent: '#D4AF37', secondary: '#8B7355', muted: '#A09888' },
        fonts: { heading: 'Playfair Display', body: 'Lato' },
      });
    } else {
      // Create empty template
      contentData = JSON.stringify([]);
      scheduleData = JSON.stringify([]);
      faqsData = JSON.stringify([]);
      storiesData = JSON.stringify([]);
      mediaData = JSON.stringify([]);
      themeData = JSON.stringify({
        colors: { bg: '#FDF8F0', text: '#2C2C2C', accent: '#D4AF37', secondary: '#8B7355', muted: '#A09888' },
        fonts: { heading: 'Playfair Display', body: 'Lato' },
      });
    }

    const maxSort = await db.contentTemplate.aggregate({ _max: { sortOrder: true } });
    const template = await db.contentTemplate.create({
      data: {
        name,
        description: description || null,
        isDefault: false,
        isActive: true,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        content: contentData,
        schedule: scheduleData,
        faqs: faqsData,
        stories: storiesData,
        media: mediaData,
        theme: themeData,
      },
    });

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      isDefault: template.isDefault,
    }, { status: 201 });
  } catch (error) {
    console.error('Content template create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/master/content-templates — update a template
// Can update: name, description, isActive, content, schedule, faqs, stories, media, theme
const updateTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  content: z.string().optional(),   // JSON string of content items
  schedule: z.string().optional(),  // JSON string of schedule items
  faqs: z.string().optional(),      // JSON string of FAQ items
  stories: z.string().optional(),   // JSON string of story items
  media: z.string().optional(),     // JSON string of media items
  theme: z.string().optional(),     // JSON string of theme
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:templates:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { id, name, description, isActive, content, schedule, faqs, stories, media, theme } = parsed.data;

    const existing = await db.contentTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) {
      const conflict = await db.contentTemplate.findFirst({ where: { name, NOT: { id } } });
      if (conflict) return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
      updateData.name = name;
    }
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (content !== undefined) updateData.content = content;
    if (schedule !== undefined) updateData.schedule = schedule;
    if (faqs !== undefined) updateData.faqs = faqs;
    if (stories !== undefined) updateData.stories = stories;
    if (media !== undefined) updateData.media = media;
    if (theme !== undefined) updateData.theme = theme;

    const template = await db.contentTemplate.update({ where: { id }, data: updateData });

    return NextResponse.json({
      id: template.id,
      name: template.name,
      description: template.description,
      isDefault: template.isDefault,
      isActive: template.isActive,
    });
  } catch (error) {
    console.error('Content template update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/master/content-templates?id=xxx
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !(await hasPlatformPermission(session.user.id, session.user.role, 'platform:templates:manage'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 });

    const existing = await db.contentTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    if (existing.isDefault) {
      return NextResponse.json({ error: 'Cannot delete the default template. Set another template as default first.' }, { status: 400 });
    }

    await db.contentTemplate.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Content template delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
