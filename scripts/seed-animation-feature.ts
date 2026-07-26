/**
 * One-time migration: seed the 'animation' WeddingFeature row for all
 * existing weddings that don't already have one.
 *
 * This preserves backward compatibility — every existing wedding keeps
 * its Gold Dust animation ON with the default gold-dust style + medium
 * density, exactly as it was before the configurable-animation feature
 * shipped.
 *
 * Usage:
 *   bun run scripts/seed-animation-feature.ts
 *
 * Safe to re-run — it skips weddings that already have an animation row.
 */

import { db } from '../src/lib/db';
import { getDefaultAnimationConfigForTier } from '../src/lib/animation-entitlements';

async function main() {
  console.log('━'.repeat(60));
  console.log('Animation Feature Migration');
  console.log('━'.repeat(60));

  // Find all weddings that don't yet have an animation feature row.
  const weddings = await db.weddingAccount.findMany({
    select: {
      id: true,
      coupleName: true,
      slug: true,
      plan: true,
      features: {
        where: { featureKey: 'animation' },
        select: { id: true },
      },
    },
  });

  const missing = weddings.filter((w) => w.features.length === 0);
  const alreadyHave = weddings.filter((w) => w.features.length > 0);

  console.log(`Total weddings: ${weddings.length}`);
  console.log(`Already have animation feature: ${alreadyHave.length}`);
  console.log(`Need animation feature seeded: ${missing.length}`);
  console.log('');

  if (missing.length === 0) {
    console.log('✓ Nothing to do — all weddings already have an animation feature row.');
    await db.$disconnect();
    return;
  }

  let seeded = 0;
  let failed = 0;

  for (const w of missing) {
    try {
      const configJson = await getDefaultAnimationConfigForTier(w.plan);
      await db.weddingFeature.create({
        data: {
          weddingId: w.id,
          featureKey: 'animation',
          isEnabled: true, // ON by default — preserves current behaviour
          config: configJson,
        },
      });
      seeded++;
      console.log(`  ✓ ${w.coupleName} (${w.slug}) [${w.plan}] → seeded`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${w.coupleName} (${w.slug}) [${w.plan}] → FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  console.log('');
  console.log('━'.repeat(60));
  console.log(`Done. Seeded: ${seeded} · Failed: ${failed}`);
  console.log('━'.repeat(60));

  await db.$disconnect();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  db.$disconnect();
  process.exit(1);
});
