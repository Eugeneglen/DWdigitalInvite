import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPlatformPermission } from '@/lib/permissions';

// POST /api/master/content-templates/[id]/apply-all
// Applies this template's content to all weddings that haven't been
// customized (themeCustomized = false). Weddings that the couple has
// manually edited are protected.
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

    // Parse template data
    const contentItems = JSON.parse(template.content) as { section: string; fieldKey: string; fieldValue: string; fieldType: string }[];
    const scheduleItems = JSON.parse(template.schedule) as { eventType: string; title: string; description: string | null; startTime: string; endTime: string | null; location: string | null; sortOrder: number }[];
    const faqItems = JSON.parse(template.faqs) as { question: string; answer: string; sortOrder: number; isActive: boolean }[];
    const storyItems = JSON.parse(template.stories) as { title: string; content: string; date: string | null; imageUrl: string | null; sortOrder: number }[];
    const mediaItems = JSON.parse(template.media) as { url: string; thumbnailUrl: string | null; fileName: string; fileType: string; category: string; sortOrder: number }[];
    // Parse the theme JSON — the authoritative source for colors + fonts
    const themeData = JSON.parse(template.theme) as { colors: { bg: string; text: string; accent: string; secondary: string; muted: string }; fonts: { heading: string; body: string } };

    // Theme items to apply (from the `theme` column, NOT the content JSON)
    const themeItems = [
      { section: 'global', fieldKey: 'backgroundColor', fieldValue: themeData.colors.bg, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'textColor', fieldValue: themeData.colors.text, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'accentColor', fieldValue: themeData.colors.accent, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'secondaryColor', fieldValue: themeData.colors.secondary, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'mutedColor', fieldValue: themeData.colors.muted, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'fontFamily', fieldValue: themeData.fonts.heading, fieldType: 'TEXT' },
      { section: 'global', fieldKey: 'bodyFont', fieldValue: themeData.fonts.body, fieldType: 'TEXT' },
      { section: 'hero', fieldKey: 'fontFamily', fieldValue: themeData.fonts.heading, fieldType: 'TEXT' },
    ];

    // Find all non-customized weddings
    const targetWeddings = await db.weddingAccount.findMany({
      where: { themeCustomized: false },
      select: { id: true, coupleName: true, weddingDate: true },
    });

    let updatedCount = 0;

    for (const wedding of targetWeddings) {
      // Delete existing content/schedule/faqs/stories/media
      await db.weddingContent.deleteMany({ where: { weddingId: wedding.id } });
      await db.eventSchedule.deleteMany({ where: { weddingId: wedding.id } });
      await db.fAQ.deleteMany({ where: { weddingId: wedding.id } });
      await db.storyItem.deleteMany({ where: { weddingId: wedding.id } });
      await db.weddingMedia.deleteMany({ where: { weddingId: wedding.id } });

      // Clone template content (substitute couple name + date)
      const dateDisplay = formatDateDisplay(wedding.weddingDate);
      await db.weddingContent.createMany({
        data: contentItems.map((item) => ({
          weddingId: wedding.id,
          section: item.section,
          fieldKey: item.fieldKey,
          fieldType: item.fieldType,
          fieldValue: (item.section === 'hero' && item.fieldKey === 'title') ? wedding.coupleName
            : (item.section === 'hero' && item.fieldKey === 'dateDisplay') ? dateDisplay
            : item.fieldValue,
        })),
      });

      await db.eventSchedule.createMany({
        data: scheduleItems.map((item) => ({ weddingId: wedding.id, ...item })),
      });

      await db.fAQ.createMany({
        data: faqItems.map((item) => ({ weddingId: wedding.id, ...item })),
      });

      await db.storyItem.createMany({
        data: storyItems.map((item) => ({ weddingId: wedding.id, ...item })),
      });

      await db.weddingMedia.createMany({
        data: mediaItems.map((item) => ({ weddingId: wedding.id, ...item })),
      });

      // Apply theme (colors + fonts) from the `theme` column — upserts into
      // section='global' so it overrides any stale values from content JSON
      for (const item of themeItems) {
        await db.weddingContent.upsert({
          where: { weddingId_section_fieldKey: { weddingId: wedding.id, section: item.section, fieldKey: item.fieldKey } },
          update: { fieldValue: item.fieldValue },
          create: { weddingId: wedding.id, ...item },
        });
      }

      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Template "${template.name}" applied to ${updatedCount} wedding(s)`,
      updatedCount,
    });
  } catch (error) {
    console.error('Apply template to all error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatDateDisplay(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();
  const suffix = (n: number) => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) { case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th'; }
  };
  return `${dayName}, ${dayNum}${suffix(dayNum)} ${monthName} ${year}`;
}
