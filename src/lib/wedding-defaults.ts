/**
 * Default wedding content templates.
 *
 * When a new wedding is created via the admin wizard, this module seeds
 * production-quality default content + schedule + FAQs + stories so the
 * couple has a complete starting template to customize (matching the
 * standard set by the seeded demo wedding).
 *
 * The placeholders use the couple's names + wedding date + venue from
 * the form, plus the same rich default copy that the seed.ts uses for
 * the demo wedding.
 *
 * Images: the teaCeremonyImage uses the same default as the seed so the
 * guest site renders properly. Story images are left NULL (couple uploads
 * their own). Section titles/subtitles are seeded so nothing shows empty.
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

// Default tea ceremony image (same as seed.ts — a stable placeholder so
// the guest site renders properly before the couple uploads their own)
const DEFAULT_TEA_CEREMONY_IMAGE = 'https://lh3.googleusercontent.com/aida-public/AB6AXuA6SiJt49KQCmMAhF-X_tmX1Y1NKhTieT6ApO53PD9gYuvLO0e78WTxzg8BV7Wnhe6oJ6';

/**
 * Seed default content, schedule, FAQs, and stories for a newly created wedding.
 * Uses production-quality default copy matching the seeded demo wedding standard.
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
  const venueName = venue || venueAddress || 'The Fullerton Hotel';

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
    { section: 'hero', fieldKey: 'teaCeremonyImage', fieldValue: DEFAULT_TEA_CEREMONY_IMAGE, fieldType: 'TEXT' },

    // schedule
    { section: 'schedule', fieldKey: 'title', fieldValue: 'The Day', fieldType: 'TEXT' },
    { section: 'schedule', fieldKey: 'subtitle', fieldValue: 'The Celebration', fieldType: 'TEXT' },

    // getting-there (full default content, matching seed standard)
    { section: 'getting-there', fieldKey: 'title', fieldValue: 'Getting There', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'subtitle', fieldValue: 'Find your way to our celebration', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'venueDescription', fieldValue: `${venueName} is a beautiful venue for our special day. We look forward to welcoming you there.`, fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'transitTitle', fieldValue: 'Public Transit', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'transitContent', fieldValue: 'MRT\nThe nearest MRT station is a short walk from the venue.\n\nBUS\nGuests may alight at the bus stop nearest to the venue. Please check local bus services for the most convenient route.\n\nFor detailed transit directions, please use Google Maps or contact us for assistance.', fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'carTitle', fieldValue: 'By Car', fieldType: 'TEXT' },
    { section: 'getting-there', fieldKey: 'carContent', fieldValue: '\nFROM THE AIRPORT\nThe journey from the airport is approximately 25–30 minutes, subject to traffic conditions.\n\nFROM THE CITY\nThe venue is easily accessible via major roads. Please use GPS navigation for the most current route.', fieldType: 'RICHTEXT' },
    { section: 'getting-there', fieldKey: 'parkingNote', fieldValue: 'PARKING\nValet parking may be available at the venue entrance. Alternatively, guests may utilise the venue\'s car park, subject to availability.\n\nKindly inform the concierge that you are attending the wedding event.\n', fieldType: 'TEXT' },

    // story
    { section: 'story', fieldKey: 'title', fieldValue: 'Our Story', fieldType: 'TEXT' },
    { section: 'story', fieldKey: 'subtitle', fieldValue: 'The Prelude', fieldType: 'TEXT' },
    { section: 'story', fieldKey: 'intro', fieldValue: 'Every great romance is a narrative woven over time. Ours began with a serendipitous meeting and has evolved into a tapestry of shared adventures, quiet moments, and a profound commitment to one another.', fieldType: 'RICHTEXT' },

    // qa
    { section: 'qa', fieldKey: 'title', fieldValue: 'Questions & Answers', fieldType: 'TEXT' },

    // wishes
    { section: 'wishes', fieldKey: 'title', fieldValue: 'Wishes', fieldType: 'TEXT' },
    { section: 'wishes', fieldKey: 'subtitle', fieldValue: 'Weave Your Blessing Into Our Archive', fieldType: 'TEXT' },

    // moments
    { section: 'moments', fieldKey: 'title', fieldValue: 'Moments', fieldType: 'TEXT' },
    { section: 'moments', fieldKey: 'subtitle', fieldValue: 'The Journey Before the I Do—from childhood dreams to our first steps together.', fieldType: 'TEXT' },

    // tea-ceremony
    { section: 'tea-ceremony', fieldKey: 'title', fieldValue: 'The Tea Ceremony', fieldType: 'TEXT' },
    { section: 'tea-ceremony', fieldKey: 'label', fieldValue: 'The Tradition', fieldType: 'TEXT' },
  ];

  await db.weddingContent.createMany({
    data: contentItems.map((item) => ({ weddingId, ...item })),
  });

  // ── 2. Default schedule (4 events, matching seed standard) ──────────
  const scheduleItems = [
    { eventType: 'TEA_CEREMONY', title: 'Tea Ceremony', description: 'Traditional tea ceremony with both families', startTime: '10:00', endTime: '12:00', location: 'Bride\'s Residence', sortOrder: 1 },
    { eventType: 'CEREMONY', title: 'Wedding Ceremony', description: 'Exchange of vows and rings', startTime: '16:00', endTime: '17:00', location: `${venueName} — Grand Ballroom`, sortOrder: 2 },
    { eventType: 'RECEPTION', title: 'Cocktail Reception', description: 'Drinks and canapés by the poolside', startTime: '17:00', endTime: '18:00', location: `${venueName} — Poolside Terrace`, sortOrder: 3 },
    { eventType: 'DINNER', title: 'Wedding Dinner', description: 'Celebration dinner', startTime: '18:00', endTime: '22:00', location: `${venueName} — Grand Ballroom`, sortOrder: 4 },
  ];

  await db.eventSchedule.createMany({
    data: scheduleItems.map((item) => ({ weddingId, ...item })),
  });

  // ── 3. Default FAQs (6 common questions, matching seed standard) ────
  const faqs = [
    { question: 'What is the dress code?', answer: 'The dress code is formal / black tie. We kindly request guests to avoid wearing white.', sortOrder: 1 },
    { question: 'Can I bring a plus one?', answer: 'Your invitation will indicate whether a plus one is included. If you\'re unsure, please reach out to us.', sortOrder: 2 },
    { question: 'Is parking available?', answer: 'Yes, complimentary valet parking is available at the venue. Self-parking is also available.', sortOrder: 3 },
    { question: 'Are children welcome?', answer: 'We love your little ones! However, due to venue restrictions, this will be an adults-only celebration.', sortOrder: 4 },
    { question: 'Can I take photos during the ceremony?', answer: 'We kindly request an unplugged ceremony. A professional photographer will capture every moment, and we\'ll share the photos with you afterwards.', sortOrder: 5 },
    { question: 'Where can I stay nearby?', answer: 'We\'ve arranged special rates at the venue hotel and several nearby hotels. Please contact us for the booking links.', sortOrder: 6 },
  ];

  await db.fAQ.createMany({
    data: faqs.map((item) => ({ weddingId, ...item })),
  });

  // ── 4. Default story chapters (4 chapters, matching seed standard) ─
  // Uses placeholder content the couple can customize. Images left NULL.
  const stories = [
    { title: 'How We Met', content: 'Share the story of how you first met — the place, the moment, the spark that started it all. Every great love story has a beginning, and this is yours to tell.', date: '', sortOrder: 1 },
    { title: 'The First Date', content: 'Tell the story of your first date — where you went, what you talked about, and the moment you knew this was something special.', date: '', sortOrder: 2 },
    { title: 'Adventures Together', content: 'Share the adventures you\'ve had together — the trips, the milestones, the quiet moments that made your journey unique.', date: '', sortOrder: 3 },
    { title: 'The Proposal', content: 'Tell the story of the proposal — where it happened, how you felt, and the moment you said yes. Make it as romantic or as fun as the real thing.', date: '', sortOrder: 4 },
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
