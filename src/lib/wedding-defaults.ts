/**
 * Default wedding content templates.
 *
 * When a new wedding is created via the admin wizard, this module seeds
 * placeholder content + schedule + FAQs so the couple has a starting point
 * to customize (rather than an empty shell).
 *
 * The placeholders use the couple's names + wedding date from the form,
 * plus generic but elegant default copy that the couple can edit.
 *
 * Images are left NULL (not seeded) so the couple uploads their own.
 * Section titles/subtitles are seeded with sensible defaults so the
 * guest site doesn't show empty headings.
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

  // Ordinal suffix
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
 * Seed default content, schedule, FAQs, and stories for a newly created wedding.
 * Safe to call — uses createMany, idempotent only if called once per wedding.
 *
 * @returns summary of items created
 */
export async function seedDefaultWeddingContent(info: WeddingCreateInfo): Promise<{
  content: number;
  schedule: number;
  faqs: number;
  stories: number;
}> {
  const { weddingId, coupleName, weddingDate, venue, venueAddress } = info;
  const dateDisplay = formatDateDisplay(weddingDate);
  const venueName = venue || venueAddress || 'Our Venue';

  // ── 1. Content items (section headings + default copy) ──────────────
  const contentItems: Array<{ section: string; fieldKey: string; fieldValue: string; fieldType: string }> = [
    // global (theme)
    { section: 'global', fieldKey: 'backgroundColor', fieldValue: '#FCF9F2', fieldType: 'TEXT' },

    // hero
    { section: 'hero', fieldKey: 'title', fieldValue: coupleName, fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'subtitle', fieldValue: 'Together with their families, request the pleasure of your company', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'description', fieldValue: 'We invite you to share in our joy as we begin our forever together.', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'dateDisplay', fieldValue: dateDisplay, fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'fontFamily', fieldValue: 'Playfair Display', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'narrativeLabel', fieldValue: 'The Prelude', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'narrativeTitle', fieldValue: 'Our Story Begins Here', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'narrativeBody', fieldValue: 'Every great romance is a narrative woven over time. Ours began with a serendipitous meeting and has evolved into a tapestry of shared adventures, quiet moments, and a profound commitment to one another.', fieldType: 'RICHTEXT' },
    { section: 'hero', fieldKey: 'teaCeremonyLabel', fieldValue: 'The Tradition', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'teaCeremonyTitle', fieldValue: 'The Tea Ceremony', fieldType: 'TEXT' },
    { section: 'hero', fieldKey: 'teaCeremonyBody', fieldValue: 'A sacred tradition where we honour our elders with tea, receiving their blessings for a lifetime of happiness together.', fieldType: 'RICHTEXT' },
    // teaCeremonyImage left NULL — couple uploads their own

    // schedule
    { section: 'schedule', fieldKey: 'title', fieldValue: 'The Day', fieldType: 'TEXT' },
    { section: 'schedule', fieldKey: 'subtitle', fieldValue: 'The Celebration', fieldType: 'TEXT' },

    // getting-there
    { section: 'getting-there', fieldKey: 'title', fieldValue: 'Getting There', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'subtitle', fieldValue: 'Find your way to our celebration', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'venueDescription', fieldValue: `${venueName} is the setting for our special day. We look forward to welcoming you there.`, fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'transitTitle', fieldValue: 'Public Transit', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'transitContent', fieldValue: 'Details on public transit options will be added here.', fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'carTitle', fieldValue: 'By Car', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'carContent', fieldValue: 'Driving directions and parking information will be added here.', fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'parkingNote', fieldValue: 'Parking details will be added here.', fieldType: 'TEXT' },

    // story
    { section: 'story', fieldKey: 'title', fieldValue: 'Our Story', fieldType: 'TEXT' },
    { section: 'story', fieldKey: 'subtitle', fieldValue: 'The Prelude', fieldType: 'TEXT' },
    { section: 'story', fieldKey: 'intro', fieldValue: 'Every great romance is a narrative woven over time. Share the story of how you met and the journey that brought you here.', fieldType: 'RICHTEXT' },

    // qa
    { section: 'qa', fieldKey: 'title', fieldValue: 'Questions & Answers', fieldType: 'TEXT' },

    // wishes
    { section: 'wishes', fieldKey: 'title', fieldValue: 'Wishes', fieldType: 'TEXT' },
    { section: 'wishes', fieldKey: 'subtitle', fieldValue: 'Weave Your Blessing Into Our Archive', fieldType: 'TEXT' },

    // moments
    { section: 'moments', fieldKey: 'title', fieldValue: 'Moments', fieldType: 'TEXT' },
    { section: 'moments', fieldKey: 'subtitle', fieldValue: 'The Journey Before the I Do — from childhood dreams to our first steps together.', fieldType: 'TEXT' },

    // tea-ceremony
    { section: 'tea-ceremony', fieldKey: 'title', fieldValue: 'The Tea Ceremony', fieldType: 'TEXT' },
    { section: 'tea-ceremony', fieldKey: 'label', fieldValue: 'The Tradition', fieldType: 'TEXT' },
  ];

  await db.weddingContent.createMany({
    data: contentItems.map((item) => ({ weddingId, ...item })),
  });

  // ── 2. Default schedule (4 placeholder events) ──────────────────────
  const scheduleItems = [
    { eventType: 'TEA_CEREMONY', title: 'Tea Ceremony', description: 'Traditional tea ceremony with both families', startTime: '10:00', endTime: '12:00', location: 'To be confirmed', sortOrder: 1 },
    { eventType: 'CEREMONY', title: 'Wedding Ceremony', description: 'Exchange of vows and rings', startTime: '16:00', endTime: '17:00', location: venueName, sortOrder: 2 },
    { eventType: 'RECEPTION', title: 'Cocktail Reception', description: 'Drinks and canapés', startTime: '17:00', endTime: '18:00', location: venueName, sortOrder: 3 },
    { eventType: 'DINNER', title: 'Wedding Dinner', description: 'Celebration dinner', startTime: '18:00', endTime: '22:00', location: venueName, sortOrder: 4 },
  ];

  await db.eventSchedule.createMany({
    data: scheduleItems.map((item) => ({ weddingId, ...item })),
  });

  // ── 3. Default FAQs (6 common questions) ────────────────────────────
  const faqs = [
    { question: 'What is the dress code?', answer: 'The dress code is formal / black tie. We kindly request guests to avoid wearing white.', sortOrder: 1 },
    { question: 'Can I bring a plus one?', answer: 'Your invitation will indicate whether a plus one is included. If you\'re unsure, please reach out to us.', sortOrder: 2 },
    { question: 'Is parking available?', answer: 'Parking details will be confirmed closer to the date. Please check back later or contact us for more information.', sortOrder: 3 },
    { question: 'Are children welcome?', answer: 'We love your little ones! However, due to venue restrictions, this will be an adults-only celebration.', sortOrder: 4 },
    { question: 'Can I take photos during the ceremony?', answer: 'We kindly request an unplugged ceremony. A professional photographer will capture every moment, and we\'ll share the photos with you afterwards.', sortOrder: 5 },
    { question: 'Where can I stay nearby?', answer: 'We will share recommended accommodation options closer to the date. Please contact us if you need recommendations.', sortOrder: 6 },
  ];

  await db.fAQ.createMany({
    data: faqs.map((item) => ({ weddingId, ...item })),
  });

  // ── 4. Default story placeholders (3 chapters, no images) ───────────
  const stories = [
    { title: 'How We Met', content: 'Share the story of how you first met — the place, the moment, the spark that started it all.', date: '', sortOrder: 1 },
    { title: 'The Proposal', content: 'Tell the story of the proposal — where it happened, how you felt, and the moment you said yes.', date: '', sortOrder: 2 },
    { title: 'Our Adventure Begins', content: 'Share your hopes and dreams for the future as you begin this new chapter together.', date: '', sortOrder: 3 },
  ];

  await db.storyItem.createMany({
    data: stories.map((item) => ({ weddingId, ...item, imageUrl: null })),
  });

  return {
    content: contentItems.length,
    schedule: scheduleItems.length,
    faqs: faqs.length,
    stories: stories.length,
  };
}
