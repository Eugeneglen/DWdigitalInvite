import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';
import { z } from 'zod/v4';

// ── Production asset base URL ────────────────────────────────────
// When replacing base64 images during cloning, use absolute URLs
// pointing to the production deployment so images resolve on ANY
// environment (local dev, staging, production).
const PRODUCTION_BASE = 'https://dwdigitalinvite-production.up.railway.app';

/**
 * Smart placeholder resolver: maps a base64 image to the best
 * matching placeholder image on the production server, based on
 * which section/field it belongs to.
 */
function resolveImagePlaceholder(section: string, fieldKey: string, fallback: string): string {
  const key = fieldKey.toLowerCase();
  const sec = section.toLowerCase();
  // Map known image fields to their production placeholder
  if (key.includes('heroimageurl') || key.includes('hero')) return `${PRODUCTION_BASE}/wedding-images/hero-portrait.png`;
  if (key.includes('banner')) return `${PRODUCTION_BASE}/wedding-images/banner-bg.png`;
  if (key.includes('venue') || key.includes('ceremonyvenue')) return `${PRODUCTION_BASE}/wedding-images/ceremony-venue.png`;
  if (key.includes('teaceremony')) return `${PRODUCTION_BASE}/wedding-images/tea-ceremony.png`;
  // Story images — cycle through milestones by order
  if (sec === 'story' || sec === 'moments') return `${PRODUCTION_BASE}/wedding-images/story-hero.png`;
  return `${PRODUCTION_BASE}${fallback}`;
}

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
      // Replace base64 images with production placeholder URLs
      const contentCleaned = contentItems.map((item) => ({
        ...item,
        fieldValue: item.fieldValue?.startsWith('data:')
          ? resolveImagePlaceholder(item.section, item.fieldKey, '/wedding-images/hero-portrait.png')
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
        imageUrl: item.imageUrl?.startsWith('data:')
          ? resolveImagePlaceholder('story', 'imageUrl', '/wedding-images/story-hero.png')
          : item.imageUrl,
      }));

      const mediaItems = await db.weddingMedia.findMany({
        where: { weddingId: cloneFromWeddingId },
        select: { url: true, thumbnailUrl: true, fileName: true, fileType: true, category: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      });
      // Gallery: cycle through gallery-N.png based on sort order
      const mediaCleaned = mediaItems.map((item, idx) => {
        const galleryNum = (idx % 7) + 1; // gallery-1 through gallery-7
        const galleryUrl = `${PRODUCTION_BASE}/wedding-images/gallery-${galleryNum}.png`;
        return {
          ...item,
          url: item.url?.startsWith('data:') ? galleryUrl : item.url,
          thumbnailUrl: item.thumbnailUrl?.startsWith('data:') ? galleryUrl : item.thumbnailUrl,
        };
      });

      contentData = JSON.stringify(contentCleaned);
      scheduleData = JSON.stringify(scheduleItems);
      faqsData = JSON.stringify(faqItems);
      storiesData = JSON.stringify(storiesCleaned);
      mediaData = JSON.stringify(mediaCleaned);

      // ── Extract theme from wedding's global section content ────────
      // The wedding stores theme values as WeddingContent rows with
      // section='global' and fieldKeys like backgroundColor, textColor, etc.
      // When a template is applied to a new wedding (wedding-defaults.ts),
      // these rows are upserted from the template's `theme` column.
      // Clone must do the reverse: reconstruct the theme JSON from these rows.
      const globalItems = contentItems.filter((c) => c.section === 'global');
      const getField = (key: string) => globalItems.find((c) => c.fieldKey === key)?.fieldValue || '';

      // Extract whatever theme values exist; fall back to defaults for
      // the rest. This handles weddings that only partially customized
      // their theme (e.g. only changed the background color).
      themeData = JSON.stringify({
        colors: {
          bg: getField('backgroundColor') || '#FDF8F0',
          text: getField('textColor') || '#2C2C2C',
          accent: getField('accentColor') || '#D4AF37',
          secondary: getField('secondaryColor') || '#8B7355',
          muted: getField('mutedColor') || '#A09888',
        },
        fonts: {
          heading: getField('fontFamily') || 'Playfair Display',
          body: getField('bodyFont') || 'Lato',
        },
      });

      // ── Inject hero/banner URLs from WeddingAccount into content ───
      // The live site reads hero/banner from WeddingAccount columns, not
      // WeddingContent. We inject them into the content JSON so the
      // template editor can display them, and they get applied to new
      // weddings via the content-clone path.
      if (wedding.heroImageUrl || wedding.bannerUrl || wedding.heroVideoUrl) {
        const contentArr = JSON.parse(contentData);
        if (wedding.heroImageUrl) {
          contentArr.push({
            section: 'hero',
            fieldKey: 'heroImageUrl',
            fieldValue: wedding.heroImageUrl.startsWith('data:')
              ? resolveImagePlaceholder('hero', 'heroImageUrl', '/wedding-images/hero-portrait.png')
              : wedding.heroImageUrl,
            fieldType: 'IMAGE',
          });
        }
        if (wedding.bannerUrl) {
          contentArr.push({
            section: 'hero',
            fieldKey: 'bannerUrl',
            fieldValue: wedding.bannerUrl.startsWith('data:')
              ? resolveImagePlaceholder('hero', 'bannerUrl', '/wedding-images/banner-bg.png')
              : wedding.bannerUrl,
            fieldType: 'IMAGE',
          });
        }
        if (wedding.heroVideoUrl) {
          contentArr.push({
            section: 'hero',
            fieldKey: 'heroVideoUrl',
            fieldValue: wedding.heroVideoUrl,
            fieldType: 'TEXT',
          });
        }
        contentData = JSON.stringify(contentArr);
      }
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
  description: z.string().nullable().optional(),
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
