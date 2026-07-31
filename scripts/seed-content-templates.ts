/**
 * Seed the default ContentTemplate from the gold standard wedding (eleanor-james-2027).
 *
 * Extracts ALL content, schedule, FAQs, stories, media, and theme from the
 * gold standard wedding, replaces base64 image data with local image paths
 * (to keep the template lightweight), and stores everything as JSON in the
 * ContentTemplate table.
 *
 * Idempotent — uses upsert by name.
 *
 * Usage: bun run scripts/seed-content-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const GOLD_STANDARD_SLUG = 'eleanor-james-2027';

// Local image paths to replace base64 data URLs
const LOCAL_IMAGE_MAP: Record<string, string> = {
  // hero/teaCeremonyImage → local file
  tea_ceremony: '/wedding-images/tea-ceremony.png',
  // getting-there/venueImage → local file
  venue: '/wedding-images/ceremony-venue.png',
  // Media gallery (moments) → local files
  moments_1: '/wedding-images/gallery-1.png',
  moments_2: '/wedding-images/gallery-2.png',
  moments_3: '/wedding-images/gallery-3.png',
  moments_4: '/wedding-images/gallery-4.png',
  moments_5: '/wedding-images/gallery-5.png',
  moments_6: '/wedding-images/gallery-6.png',
  moments_7: '/wedding-images/gallery-7.png',
  // Story images → local files
  story_1: '/wedding-images/milestone-began.png',
  story_2: '/wedding-images/milestone-early-years.png',
  story_3: '/wedding-images/milestone-adventure.png',
  story_4: '/wedding-images/timeline-proposal.png',
  // Schedule images
  schedule_1: '/wedding-images/ceremony-venue.png',
  schedule_2: '/wedding-images/celebration-venue.png',
};

// Classic Elegance theme (from src/lib/wedding-templates.ts)
const CLASSIC_ELEGANCE_THEME = {
  colors: {
    bg: '#FDF8F0',
    text: '#2C2C2C',
    accent: '#D4AF37',
    secondary: '#8B7355',
    muted: '#A09888',
  },
  fonts: {
    heading: 'Playfair Display',
    body: 'Lato',
  },
};

/**
 * Replace base64 data URLs with local image paths.
 * If the value is a base64 data URL (starts with "data:"), replace with the
 * corresponding local path. Otherwise keep the original value.
 */
function replaceBase64Images(value: string): string {
  if (!value) return value;
  // Check if it's a base64 data URL
  if (value.startsWith('data:image/')) {
    // Can't identify which image it is from base64, return a generic placeholder
    // The specific replacements happen in the structured extraction below
    return '/wedding-images/hero-portrait.png';
  }
  return value;
}

async function main() {
  console.log('━'.repeat(60));
  console.log('Seeding ContentTemplate from gold standard wedding');
  console.log('━'.repeat(60));

  const goldStandard = await db.weddingAccount.findUnique({
    where: { slug: GOLD_STANDARD_SLUG },
    select: { id: true },
  });

  if (!goldStandard) {
    console.error(`Gold standard wedding '${GOLD_STANDARD_SLUG}' not found!`);
    process.exit(1);
  }

  // ── 1. Extract content ────────────────────────────────────────────────
  const contentItems = await db.weddingContent.findMany({
    where: { weddingId: goldStandard.id },
    select: { section: true, fieldKey: true, fieldValue: true, fieldType: true },
    orderBy: [{ section: 'asc' }, { fieldKey: 'asc' }],
  });

  // Replace base64 images with local paths
  const contentCleaned = contentItems.map((item) => {
    let fieldValue = item.fieldValue;
    if (item.section === 'hero' && item.fieldKey === 'teaCeremonyImage' && fieldValue.startsWith('data:')) {
      fieldValue = LOCAL_IMAGE_MAP.tea_ceremony;
    }
    if (item.section === 'getting-there' && item.fieldKey === 'venueImage' && fieldValue.startsWith('data:')) {
      fieldValue = LOCAL_IMAGE_MAP.venue;
    }
    return { section: item.section, fieldKey: item.fieldKey, fieldValue, fieldType: item.fieldType };
  });

  console.log(`  ✓ Content: ${contentCleaned.length} items`);

  // ── 2. Extract schedule ───────────────────────────────────────────────
  const scheduleItems = await db.eventSchedule.findMany({
    where: { weddingId: goldStandard.id },
    select: { eventType: true, title: true, description: true, startTime: true, endTime: true, location: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`  ✓ Schedule: ${scheduleItems.length} items`);

  // ── 3. Extract FAQs ───────────────────────────────────────────────────
  const faqItems = await db.fAQ.findMany({
    where: { weddingId: goldStandard.id },
    select: { question: true, answer: true, sortOrder: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`  ✓ FAQs: ${faqItems.length} items`);

  // ── 4. Extract stories ────────────────────────────────────────────────
  const storyItems = await db.storyItem.findMany({
    where: { weddingId: goldStandard.id },
    select: { title: true, content: true, date: true, imageUrl: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });

  // Replace base64 story images with local paths
  const storyKeys = ['story_1', 'story_2', 'story_3', 'story_4'];
  const storiesCleaned = storyItems.map((item, idx) => ({
    ...item,
    imageUrl: item.imageUrl?.startsWith('data:')
      ? LOCAL_IMAGE_MAP[storyKeys[idx]] || LOCAL_IMAGE_MAP.story_1
      : item.imageUrl,
  }));
  console.log(`  ✓ Stories: ${storiesCleaned.length} items`);

  // ── 5. Extract media ──────────────────────────────────────────────────
  const mediaItems = await db.weddingMedia.findMany({
    where: { weddingId: goldStandard.id },
    select: { url: true, thumbnailUrl: true, fileName: true, fileType: true, category: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' },
  });

  // Replace base64 media URLs with local paths
  const momentsKeys = ['moments_1', 'moments_2', 'moments_3', 'moments_4', 'moments_5', 'moments_6', 'moments_7'];
  const mediaCleaned = mediaItems.map((item, idx) => {
    let url = item.url;
    let thumbnailUrl = item.thumbnailUrl;
    if (url?.startsWith('data:')) {
      const localPath = LOCAL_IMAGE_MAP[momentsKeys[idx]] || LOCAL_IMAGE_MAP.moments_1;
      url = localPath;
      thumbnailUrl = localPath;
    }
    return { url, thumbnailUrl, fileName: item.fileName, fileType: item.fileType, category: item.category, sortOrder: item.sortOrder };
  });
  console.log(`  ✓ Media: ${mediaCleaned.length} items`);

  // ── 6. Upsert the ContentTemplate ─────────────────────────────────────
  const template = await db.contentTemplate.upsert({
    where: { name: 'Classic Elegance' },
    update: {
      description: 'Timeless cream and gold palette with elegant serif typography. The default template for all new couples.',
      isDefault: true,
      isActive: true,
      sortOrder: 1,
      content: JSON.stringify(contentCleaned),
      schedule: JSON.stringify(scheduleItems),
      faqs: JSON.stringify(faqItems),
      stories: JSON.stringify(storiesCleaned),
      media: JSON.stringify(mediaCleaned),
      theme: JSON.stringify(CLASSIC_ELEGANCE_THEME),
    },
    create: {
      name: 'Classic Elegance',
      description: 'Timeless cream and gold palette with elegant serif typography. The default template for all new couples.',
      isDefault: true,
      isActive: true,
      sortOrder: 1,
      content: JSON.stringify(contentCleaned),
      schedule: JSON.stringify(scheduleItems),
      faqs: JSON.stringify(faqItems),
      stories: JSON.stringify(storiesCleaned),
      media: JSON.stringify(mediaCleaned),
      theme: JSON.stringify(CLASSIC_ELEGANCE_THEME),
    },
  });

  console.log('');
  console.log(`✅ ContentTemplate seeded: ${template.name} (id: ${template.id})`);
  console.log(`   Content: ${contentCleaned.length} items`);
  console.log(`   Schedule: ${scheduleItems.length} items`);
  console.log(`   FAQs: ${faqItems.length} items`);
  console.log(`   Stories: ${storiesCleaned.length} items`);
  console.log(`   Media: ${mediaCleaned.length} items`);
  console.log(`   Theme: Classic Elegance colors + fonts`);
  console.log(`   Images: local paths (no base64 data stored in template)`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
