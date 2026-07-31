/**
 * Phase 2 Migration: populate UserWeddingRole from existing FK assignments.
 *
 * This is a one-time, idempotent migration that reads the existing
 * ownerId / consultantId / coordinatorId FKs on WeddingAccount and creates
 * corresponding rows in the UserWeddingRole junction table.
 *
 * Mapping (legacy FK → new per-wedding role):
 *   ownerId        → 'COUPLE'
 *   consultantId   → 'CONSULTANT_1'   (ADMIN_1 → CONSULTANT_1)
 *   coordinatorId  → 'COORDINATOR'    (ADMIN_2 → COORDINATOR)
 *
 * Also updates User.role for platform staff to the new Tier 1 vocabulary:
 *   ADMIN_1          → CONSULTANT_1   (NOTE: kept as-is; see below)
 *   ADMIN_2          → COORDINATOR    (NOTE: kept as-is; see below)
 *   ACCOUNT_MANAGER  → ACCOUNT_MANAGER_1
 *   ADMIN_3          → (no change; will be removed in Phase 3c)
 *
 * IMPORTANT: In Phase 2 we do NOT rename User.role values yet. The existing
 * inline `role === 'ADMIN_1'` checks still need to work until Phase 3b
 * rewires them. So we only:
 *   1. Create UserWeddingRole rows (additive, new table)
 *   2. Leave User.role strings unchanged
 *
 * User.role renaming happens in Phase 3c (after all routes use the new
 * permission layer).
 *
 * Usage: bun run scripts/migrate-roles.ts
 * Safe to re-run — skips rows that already exist (via @@unique upsert).
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('━'.repeat(60));
  console.log('Phase 2: Migrate role assignments → UserWeddingRole');
  console.log('━'.repeat(60));

  const weddings = await db.weddingAccount.findMany({
    select: {
      id: true,
      slug: true,
      coupleName: true,
      ownerId: true,
      consultantId: true,
      coordinatorId: true,
    },
  });

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const w of weddings) {
    console.log(`\n${w.coupleName} (${w.slug}):`);

    // Build the list of (userId, role) pairs to migrate for this wedding
    const assignments: { userId: string; role: string; source: string }[] = [];
    if (w.ownerId) assignments.push({ userId: w.ownerId, role: 'COUPLE', source: 'ownerId' });
    if (w.consultantId) assignments.push({ userId: w.consultantId, role: 'CONSULTANT_1', source: 'consultantId' });
    if (w.coordinatorId) assignments.push({ userId: w.coordinatorId, role: 'COORDINATOR', source: 'coordinatorId' });

    if (assignments.length === 0) {
      console.log('  (no FK assignments — skipping)');
      continue;
    }

    for (const a of assignments) {
      try {
        // Upsert — if the row already exists (re-run), skip silently
        const existing = await db.userWeddingRole.findFirst({
          where: { userId: a.userId, weddingId: w.id, role: a.role },
        });
        if (existing) {
          console.log(`  ✓ ${a.role} ← ${a.source} (already migrated, skipped)`);
          skipped++;
          continue;
        }

        await db.userWeddingRole.create({
          data: { userId: a.userId, weddingId: w.id, role: a.role },
        });
        console.log(`  ✓ ${a.role} ← ${a.source} (created)`);
        created++;
      } catch (err) {
        console.error(`  ✗ ${a.role} ← ${a.source} → FAILED:`, err instanceof Error ? err.message : err);
        errors++;
      }
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log(`Migration complete. Created: ${created} · Skipped (already existed): ${skipped} · Errors: ${errors}`);
  console.log('━'.repeat(60));

  // Summary of final state
  console.log('\n=== Final UserWeddingRole state ===');
  const allRoles = await db.userWeddingRole.findMany({
    include: {
      user: { select: { email: true, name: true } },
      wedding: { select: { slug: true, coupleName: true } },
    },
    orderBy: [{ weddingId: 'asc' }, { role: 'asc' }],
  });
  for (const r of allRoles) {
    console.log(`  ${r.wedding.slug} | ${r.role} | ${r.user.email} (${r.user.name})`);
  }
  console.log(`Total UserWeddingRole rows: ${allRoles.length}`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
