/**
 * Default wedding content — clones the gold standard template wedding.
 *
 * The wedding with slug 'eleanor-james-2027' is the GOLD STANDARD template.
 * When a new wedding is created via the admin wizard, this module clones
 * ALL content, schedule, FAQs, stories, and media from the gold standard
 * into the new wedding — so the couple sees exactly the same populated
 * CMS as the demo wedding, and then edits it to make it their own.
 *
 * Only two fields are substituted with the new couple's details:
 *   - hero/title        → coupleName
 *   - hero/dateDisplay  → formatted wedding date
 *
 * Everything else (venue text, transit directions, stories, images, FAQs,
 * schedule, media) is copied verbatim from the gold standard.
 *
 * If the admin updates the gold standard wedding's content, new weddings
 * will automatically get the updated template (read live at creation time).
 */

import { db } from '@/lib/db';

/** The slug of the gold standard template wedding */
const GOLD_STANDARD_SLUG = 'eleanor-james-2027';

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

/**
 * Clone all content, schedule, FAQs, stories, and media from the gold
 * standard template wedding into a newly created wedding.
 *
 * @returns summary of items created, or null if the gold standard was not found
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

  // ── Find the gold standard template wedding ─────────────────────────
  const template = await db.weddingAccount.findUnique({
    where: { slug: GOLD_STANDARD_SLUG },
    select: { id: true },
  });

  if (!template) {
    console.error(`[wedding-defaults] Gold standard wedding '${GOLD_STANDARD_SLUG}' not found — cannot clone content`);
    return null;
  }

  // ── 1. Clone content (substitute hero/title + hero/dateDisplay) ─────
  const templateContent = await db.weddingContent.findMany({
    where: { weddingId: template.id },
  });

  await db.weddingContent.createMany({
    data: templateContent.map((item) => ({
      weddingId,
      section: item.section,
      fieldKey: item.fieldKey,
      fieldType: item.fieldType,
      fieldValue: substituteTemplateValues(item.section, item.fieldKey, item.fieldValue, coupleName, dateDisplay),
    })),
  });

  // ── 2. Clone schedule ───────────────────────────────────────────────
  const templateSchedule = await db.eventSchedule.findMany({
    where: { weddingId: template.id },
    orderBy: { sortOrder: 'asc' },
  });

  await db.eventSchedule.createMany({
    data: templateSchedule.map((item) => ({
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

  // ── 3. Clone FAQs ───────────────────────────────────────────────────
  const templateFaqs = await db.fAQ.findMany({
    where: { weddingId: template.id },
    orderBy: { sortOrder: 'asc' },
  });

  await db.fAQ.createMany({
    data: templateFaqs.map((item) => ({
      weddingId,
      question: item.question,
      answer: item.answer,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    })),
  });

  // ── 4. Clone stories (including images) ─────────────────────────────
  const templateStories = await db.storyItem.findMany({
    where: { weddingId: template.id },
    orderBy: { sortOrder: 'asc' },
  });

  await db.storyItem.createMany({
    data: templateStories.map((item) => ({
      weddingId,
      title: item.title,
      content: item.content,
      date: item.date,
      imageUrl: item.imageUrl,
      sortOrder: item.sortOrder,
    })),
  });

  // ── 5. Clone media (including base64 images) ────────────────────────
  const templateMedia = await db.weddingMedia.findMany({
    where: { weddingId: template.id },
    orderBy: { sortOrder: 'asc' },
  });

  await db.weddingMedia.createMany({
    data: templateMedia.map((item) => ({
      weddingId,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      fileName: item.fileName,
      fileType: item.fileType,
      fileSize: item.fileSize,
      category: item.category,
      sortOrder: item.sortOrder,
    })),
  });

  return {
    content: templateContent.length,
    schedule: templateSchedule.length,
    faqs: templateFaqs.length,
    stories: templateStories.length,
    media: templateMedia.length,
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
