/**
 * Migration script: move existing base64 data URLs from the database to
 * the file storage backend.
 *
 * Scans WeddingAccount.heroImageUrl, heroVideoUrl, bannerUrl and
 * WeddingMedia.url for base64 data URLs, uploads each to the file storage
 * backend, and updates the DB row with the returned file URL.
 *
 * Usage:
 *   bun run scripts/migrate-base64-to-files.ts
 *
 * Safe to re-run — skips URLs that are already file URLs or external URLs.
 */

import { db } from '../src/lib/db';
import { uploadDataUrl, isDataUrl } from '../src/lib/file-storage';

async function migrateWeddingAccountFields() {
  console.log('━'.repeat(60));
  console.log('Migrating WeddingAccount base64 fields');
  console.log('━'.repeat(60));

  const weddings = await db.weddingAccount.findMany({
    select: { id: true, coupleName: true, slug: true, heroImageUrl: true, heroVideoUrl: true, bannerUrl: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const w of weddings) {
    console.log(`\n${w.coupleName} (${w.slug}):`);

    for (const [field, category] of [
      ['heroImageUrl', 'hero'] as const,
      ['heroVideoUrl', 'hero'] as const,
      ['bannerUrl', 'banner'] as const,
    ]) {
      const value = w[field] as string | null;
      if (!value || !isDataUrl(value)) {
        skipped++;
        continue;
      }

      try {
        const fileName = `${w.slug}-${field}`;
        const result = await uploadDataUrl(value, w.id, category, fileName);
        await db.weddingAccount.update({
          where: { id: w.id },
          data: { [field]: result.url },
        });
        console.log(`  ✓ ${field} → ${result.url} (${(result.fileSize / 1024).toFixed(0)} KB)`);
        migrated++;
      } catch (err) {
        console.error(`  ✗ ${field} → FAILED:`, err instanceof Error ? err.message : err);
      }
    }
  }

  console.log(`\nWeddingAccount: ${migrated} migrated, ${skipped} skipped`);
  return migrated;
}

async function migrateWeddingMediaUrls() {
  console.log('\n' + '━'.repeat(60));
  console.log('Migrating WeddingMedia base64 URLs');
  console.log('━'.repeat(60));

  const mediaItems = await db.weddingMedia.findMany({
    select: { id: true, weddingId: true, url: true, fileName: true, fileType: true, category: true },
    take: 500, // Process in batches to avoid memory issues
  });

  let migrated = 0;
  let skipped = 0;

  for (const m of mediaItems) {
    if (!m.url || !isDataUrl(m.url)) {
      skipped++;
      continue;
    }

    try {
      // Map DB categories to FileCategory, falling back to 'gallery'
      const categoryMap: Record<string, 'hero' | 'banner' | 'gallery' | 'story' | 'wishes' | 'moments' | 'schedule' | 'couple-photo'> = {
        hero: 'hero', banner: 'banner', gallery: 'gallery', story: 'story',
        wishes: 'wishes', moments: 'moments', schedule: 'schedule', 'couple-photo': 'couple-photo',
      };
      const category = categoryMap[m.category] || 'gallery';
      const fileName = m.fileName || `media-${m.id}`;
      const result = await uploadDataUrl(m.url, m.weddingId, category, fileName);
      await db.weddingMedia.update({
        where: { id: m.id },
        data: { url: result.url },
      });
      console.log(`  ✓ ${m.id} → ${result.url} (${(result.fileSize / 1024).toFixed(0)} KB)`);
      migrated++;
    } catch (err) {
      console.error(`  ✗ ${m.id} → FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nWeddingMedia: ${migrated} migrated, ${skipped} skipped`);
  return migrated;
}

async function main() {
  console.log('Base64 → File Storage Migration');
  console.log('This will move all base64 data URLs from the DB to files on disk.\n');

  const accountCount = await migrateWeddingAccountFields();
  const mediaCount = await migrateWeddingMediaUrls();

  console.log('\n' + '━'.repeat(60));
  console.log(`Migration complete. Total: ${accountCount + mediaCount} files migrated.`);
  console.log('━'.repeat(60));

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  db.$disconnect();
  process.exit(1);
});
