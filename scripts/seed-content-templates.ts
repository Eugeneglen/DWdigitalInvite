/**
 * Seed the default ContentTemplate from the gold standard wedding (eleanor-james-2027).
 *
 * Extracts ALL content, schedule, FAQs, stories, media, and theme from the
 * gold standard wedding, replaces base64 image data with local image paths
 * (to keep the template lightweight), and stores everything as JSON in the
 * ContentTemplate table.
 *
 * IMPORTANT: This script only creates the template if NO default template
 * already exists. It will NEVER overwrite admin customizations made via the
 * CMS Template Editor. This protects the admin's work across Railway
 * redeployments.
 *
 * Theme is extracted from the wedding's `global` section WeddingContent rows
 * (matching the reverse of wedding-defaults.ts apply logic).
 *
 * Hero/banner URLs from WeddingAccount columns are injected into the content
 * JSON so they get applied to new weddings.
 *
 * Usage: bun run scripts/seed-content-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const GOLD_STANDARD_SLUG = 'eleanor-james-2027';
const TEMPLATE_NAME = 'Gold Standard Template';

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

// Fallback theme used only when the wedding has NO global section content
const FALLBACK_THEME = {
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

async function main() {
  console.log('━'.repeat(60));
  console.log('Seeding ContentTemplate from gold standard wedding');
  console.log('━'.repeat(60));

  const goldStandard = await db.weddingAccount.findUnique({
    where: { slug: GOLD_STANDARD_SLUG },
    select: { id: true, heroImageUrl: true, bannerUrl: true, heroVideoUrl: true },
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
    if (item.section === 'hero' && item.fieldKey === 'teaCeremonyImage' && fieldValue?.startsWith('data:')) {
      fieldValue = LOCAL_IMAGE_MAP.tea_ceremony;
    }
    if (item.section === 'getting-there' && item.fieldKey === 'venueImage' && fieldValue?.startsWith('data:')) {
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

  // ── 6. Extract theme from wedding's global section content ────────────
  // The wedding stores theme values as WeddingContent rows with
  // section='global' and fieldKeys like backgroundColor, textColor, etc.
  // This is the reverse of wedding-defaults.ts step 6.
  const globalItems = contentCleaned.filter((c) => c.section === 'global');
  const getField = (key: string) => globalItems.find((c) => c.fieldKey === key)?.fieldValue || '';

  const extractedBg = getField('backgroundColor');
  const extractedText = getField('textColor');
  const extractedAccent = getField('accentColor');

  // Use extracted values if the primary background color exists; fall back
  // the rest to defaults. This handles weddings that only partially
  // customized their theme (e.g. only changed the background).
  const themeData = {
    colors: {
      bg: extractedBg || FALLBACK_THEME.colors.bg,
      text: getField('textColor') || FALLBACK_THEME.colors.text,
      accent: getField('accentColor') || FALLBACK_THEME.colors.accent,
      secondary: getField('secondaryColor') || FALLBACK_THEME.colors.secondary,
      muted: getField('mutedColor') || FALLBACK_THEME.colors.muted,
    },
    fonts: {
      heading: getField('fontFamily') || FALLBACK_THEME.fonts.heading,
      body: getField('bodyFont') || FALLBACK_THEME.fonts.body,
    },
  };
  console.log(`  ✓ Theme: bg=${themeData.colors.bg} accent=${themeData.colors.accent} font=${themeData.fonts.heading}`);

  // ── 7. Inject hero/banner URLs from WeddingAccount into content ─────────
  // The live site reads hero/banner from WeddingAccount columns, not
  // WeddingContent. We inject them so the template editor can display them
  // and they get applied to new weddings via wedding-defaults.ts step 7.
  if (goldStandard.heroImageUrl) {
    contentCleaned.push({
      section: 'hero',
      fieldKey: 'heroImageUrl',
      fieldValue: goldStandard.heroImageUrl.startsWith('data:')
        ? LOCAL_IMAGE_MAP.moments_1 // placeholder for base64
        : goldStandard.heroImageUrl,
      fieldType: 'IMAGE',
    });
    console.log(`  ✓ Hero image URL injected`);
  }
  if (goldStandard.bannerUrl) {
    contentCleaned.push({
      section: 'hero',
      fieldKey: 'bannerUrl',
      fieldValue: goldStandard.bannerUrl.startsWith('data:')
        ? LOCAL_IMAGE_MAP.moments_1
        : goldStandard.bannerUrl,
      fieldType: 'IMAGE',
    });
    console.log(`  ✓ Banner URL injected`);
  }
  if (goldStandard.heroVideoUrl) {
    contentCleaned.push({
      section: 'hero',
      fieldKey: 'heroVideoUrl',
      fieldValue: goldStandard.heroVideoUrl,
      fieldType: 'TEXT',
    });
    console.log(`  ✓ Hero video URL injected`);
  }

  // ── 8. Create the ContentTemplate (only if no default exists) ────
  // Never overwrite admin customizations. If a default template already
  // exists (created via CMS or a previous seed), skip entirely.
  const existingDefault = await db.contentTemplate.findFirst({
    where: { isDefault: true, isActive: true },
  });

  if (existingDefault) {
    const contentCount = JSON.parse(existingDefault.content || '[]').length;
    console.log('');
    console.log(`⏭️  Default template already exists: "${existingDefault.name}" (${contentCount} content items) — skipping to preserve admin customizations.`);
    await db.$disconnect();
    return;
  }

  // Also check if our named template already exists (but is not default)
  const existingNamed = await db.contentTemplate.findUnique({
    where: { name: TEMPLATE_NAME },
  });
  if (existingNamed) {
    console.log('');
    console.log(`⏭️  Template "${TEMPLATE_NAME}" already exists but is not the default — skipping.`);
    await db.$disconnect();
    return;
  }

  const template = await db.contentTemplate.create({
    data: {
      name: TEMPLATE_NAME,
      description: 'Timeless cream and gold palette with elegant serif typography. The default template for all new couples.',
      isDefault: true,
      isActive: true,
      sortOrder: 1,
      content: JSON.stringify(contentCleaned),
      schedule: JSON.stringify(scheduleItems),
      faqs: JSON.stringify(faqItems),
      stories: JSON.stringify(storiesCleaned),
      media: JSON.stringify(mediaCleaned),
      theme: JSON.stringify(themeData),
    },
  });

  console.log('');
  console.log(`✅ ContentTemplate seeded: ${template.name} (id: ${template.id})`);
  console.log(`   Content: ${contentCleaned.length} items`);
  console.log(`   Schedule: ${scheduleItems.length} items`);
  console.log(`   FAQs: ${faqItems.length} items`);
  console.log(`   Stories: ${storiesCleaned.length} items`);
  console.log(`   Media: ${mediaCleaned.length} items`);
  console.log(`   Theme: bg=${themeData.colors.bg} accent=${themeData.colors.accent}`);
  console.log(`   Images: local paths (no base64 data stored in template)`);

  await db.$disconnect();
}

// Exit 0 on success, exit 1 on failure — keeps the Dockerfile CMD `&&` chain
// honest (server only starts if seeding actually succeeded).
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  });
