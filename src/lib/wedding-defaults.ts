/**
 * Default wedding content — reads from the ContentTemplate table.
 *
 * The default ContentTemplate (isDefault=true) is cloned into every newly
 * created wedding. Admins can manage templates via the Content Templates
 * page — change the default, create seasonal variants, etc.
 *
 * Only hero/title and hero/dateDisplay are substituted with the new
 * couple's details. Everything else is copied verbatim from the template.
 *
 * Images are stored as absolute production URLs or external hosted URLs
 * (not base64) in the template, keeping it lightweight. Couples replace
 * them with their own uploads.
 */

import { db } from '@/lib/db';

interface WeddingCreateInfo {
  weddingId: string;
  coupleName: string;
  brideName?: string | null;
  groomName?: string | null;
  weddingDate: Date;
  weddingTime?: string | null;
  venue?: string | null;
  venueAddress?: string | null;
}

/**
 * Format a Date as a human-readable display string.
 * e.g. "Saturday, 25th December 2027"
 */
function formatDateDisplay(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const dayName = days[date.getDay()];
  const dayNum = date.getDate();
  const monthName = months[date.getMonth()];
  const year = date.getFullYear();

  const suffix = (n: number): string => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return `${dayName}, ${dayNum}${suffix(dayNum)} ${monthName} ${year}`;
}

interface TemplateContentItem {
  section: string;
  fieldKey: string;
  fieldValue: string;
  fieldType: string;
}

interface TemplateScheduleItem {
  eventType: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  sortOrder: number;
}

interface TemplateFaqItem {
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
}

interface TemplateStoryItem {
  title: string;
  content: string;
  date: string | null;
  imageUrl: string | null;
  sortOrder: number;
}

interface TemplateMediaItem {
  url: string;
  thumbnailUrl: string | null;
  fileName: string;
  fileType: string;
  category: string;
  sortOrder: number;
}

/**
 * Seed default content, schedule, FAQs, stories, and media for a newly
 * created wedding. Reads from the default ContentTemplate in the DB.
 *
 * @returns summary of items created, or null if no template was found
 */
export async function seedDefaultWeddingContent(info: WeddingCreateInfo): Promise<{
  content: number;
  schedule: number;
  faqs: number;
  stories: number;
  media: number;
} | null> {
  const { weddingId, coupleName, weddingDate } = info;
  const dateDisplay = formatDateDisplay(weddingDate);

  // ── Find the default ContentTemplate ──────────────────────────────────
  const template = await db.contentTemplate.findFirst({
    where: { isDefault: true, isActive: true },
  });

  if (!template) {
    console.error('[wedding-defaults] No default ContentTemplate found — cannot seed content');
    return null;
  }

  // Parse template JSON data
  const contentItems: TemplateContentItem[] = JSON.parse(template.content);
  const scheduleItems: TemplateScheduleItem[] = JSON.parse(template.schedule);
  const faqItems: TemplateFaqItem[] = JSON.parse(template.faqs);
  const storyItems: TemplateStoryItem[] = JSON.parse(template.stories);
  const mediaItems: TemplateMediaItem[] = JSON.parse(template.media);

  // Parse the theme JSON (colors + fonts) — this is the authoritative source
  // for the template's visual theme, separate from the content items.
  const themeData = JSON.parse(template.theme) as {
    colors: { bg: string; text: string; accent: string; secondary: string; muted: string };
    fonts: { heading: string; body: string };
  };

  // ── 1. Clone content (substitute hero/title + hero/dateDisplay) ───────
  await db.weddingContent.createMany({
    data: contentItems.map((item) => ({
      weddingId,
      section: item.section,
      fieldKey: item.fieldKey,
      fieldType: item.fieldType,
      fieldValue: substituteTemplateValues(item.section, item.fieldKey, item.fieldValue, coupleName, dateDisplay),
    })),
  });

  // ── 2. Clone schedule ─────────────────────────────────────────────────
  await db.eventSchedule.createMany({
    data: scheduleItems.map((item) => ({
      weddingId,
      eventType: item.eventType,
      title: item.title,
      description: item.description,
      startTime: item.startTime,
      endTime: item.endTime,
      location: item.location,
      sortOrder: item.sortOrder,
    })),
  });

  // ── 3. Clone FAQs ─────────────────────────────────────────────────────
  await db.fAQ.createMany({
    data: faqItems.map((item) => ({
      weddingId,
      question: item.question,
      answer: item.answer,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    })),
  });

  // ── 4. Clone stories ──────────────────────────────────────────────────
  await db.storyItem.createMany({
    data: storyItems.map((item) => ({
      weddingId,
      title: item.title,
      content: item.content,
      date: item.date,
      imageUrl: item.imageUrl,
      sortOrder: item.sortOrder,
    })),
  });

  // ── 5. Clone media ────────────────────────────────────────────────────
  await db.weddingMedia.createMany({
    data: mediaItems.map((item) => ({
      weddingId,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      fileName: item.fileName,
      fileType: item.fileType,
      category: item.category,
      sortOrder: item.sortOrder,
    })),
  });

  // ── 6. Apply theme (colors + fonts) from the template's `theme` column ─
  // This OVERWRITES any stale `global` section values that were cloned from
  // the content JSON in step 1. The `theme` column is the authoritative source
  // for the template's visual theme.
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
  for (const item of themeItems) {
    await db.weddingContent.upsert({
      where: { weddingId_section_fieldKey: { weddingId, section: item.section, fieldKey: item.fieldKey } },
      update: { fieldValue: item.fieldValue },
      create: { weddingId, ...item },
    });
  }

  // ── 7. Apply hero/banner URLs from content to WeddingAccount columns ──
  // The template stores hero/banner URLs as content items (section='hero',
  // fieldKey='heroImageUrl'|'bannerUrl'|'heroVideoUrl'). The live site reads
  // these from WeddingAccount columns, so we must copy them there.
  const heroImage = contentItems.find((c) => c.section === 'hero' && c.fieldKey === 'heroImageUrl');
  const banner = contentItems.find((c) => c.section === 'hero' && c.fieldKey === 'bannerUrl');
  const heroVideo = contentItems.find((c) => c.section === 'hero' && c.fieldKey === 'heroVideoUrl');
  const accountUpdate: Record<string, string | null> = {};
  if (heroImage?.fieldValue) accountUpdate.heroImageUrl = heroImage.fieldValue;
  if (banner?.fieldValue) accountUpdate.bannerUrl = banner.fieldValue;
  if (heroVideo?.fieldValue) accountUpdate.heroVideoUrl = heroVideo.fieldValue;
  if (Object.keys(accountUpdate).length > 0) {
    await db.weddingAccount.update({ where: { id: weddingId }, data: accountUpdate });
  }

  return {
    content: contentItems.length,
    schedule: scheduleItems.length,
    faqs: faqItems.length,
    stories: storyItems.length,
    media: mediaItems.length,
  };
}

/**
 * Substitute couple-specific values into template content fields.
 * Only hero/title and hero/dateDisplay are substituted — everything else
 * is copied verbatim so the couple can edit it themselves.
 */
function substituteTemplateValues(
  section: string,
  fieldKey: string,
  originalValue: string,
  coupleName: string,
  dateDisplay: string,
): string {
  if (section === 'hero' && fieldKey === 'title') {
    return coupleName;
  }
  if (section === 'hero' && fieldKey === 'dateDisplay') {
    return dateDisplay;
  }
  return originalValue;
}
