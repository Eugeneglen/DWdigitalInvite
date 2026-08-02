/**
 * Migrate existing User.role values to the new DB-driven vocabulary.
 *
 * Mapping (old → new):
 *   SUPER_ADMIN     → SUPER_ADMIN_1
 *   ADMIN_1         → CONSULTANT_1
 *   ADMIN_2         → COORDINATOR_1
 *   ADMIN_3         → SUPPORT_1
 *   ACCOUNT_MANAGER → SUPER_ADMIN_2
 *   ACCOUNT_MANAGER_1 → CONSULTANT_1  (Phase 1-4 intermediate vocab)
 *   ACCOUNT_MANAGER_2 → COORDINATOR_1 (Phase 1-4 intermediate vocab)
 *   SUPPORT         → SUPPORT_1       (Phase 1-4 intermediate vocab)
 *   COUPLE          → COUPLE          (unchanged)
 *
 * Idempotent — only updates users whose role is not already a valid Role.key.
 *
 * Usage: bun run scripts/migrate-roles-v2.ts
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const ROLE_MIGRATION_MAP: Record<string, string> = {
  // Legacy
  SUPER_ADMIN: 'SUPER_ADMIN_1',
  ADMIN_1: 'CONSULTANT_1',
  ADMIN_2: 'COORDINATOR_1',
  ADMIN_3: 'SUPPORT_1',
  ACCOUNT_MANAGER: 'SUPER_ADMIN_2',
  // Phase 1-4 intermediate vocabulary
  ACCOUNT_MANAGER_1: 'CONSULTANT_1',
  ACCOUNT_MANAGER_2: 'COORDINATOR_1',
  SUPPORT: 'SUPPORT_1',
  // Already correct (no migration needed)
  SUPER_ADMIN_1: 'SUPER_ADMIN_1',
  SUPER_ADMIN_2: 'SUPER_ADMIN_2',
  CONSULTANT_1: 'CONSULTANT_1',
  CONSULTANT_2: 'CONSULTANT_2',
  COORDINATOR_1: 'COORDINATOR_1',
  SUPPORT_1: 'SUPPORT_1',
  SUPPORT_2: 'SUPPORT_2',
  COUPLE: 'COUPLE',
};

async function main() {
  console.log('━'.repeat(60));
  console.log('Migrating User.role values to new vocabulary');
  console.log('━'.repeat(60));

  // Get all valid role keys
  const validRoles = await db.role.findMany({ select: { key: true } });
  const validKeys = new Set(validRoles.map((r) => r.key));
  console.log(`Valid role keys: ${Array.from(validKeys).join(', ')}`);
  console.log('');

  const users = await db.user.findMany({ select: { id: true, email: true, name: true, role: true } });
  console.log(`Found ${users.length} users to check.`);
  console.log('');

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of users) {
    const newRole = ROLE_MIGRATION_MAP[user.role];

    if (!newRole) {
      console.error(`  ✗ ${user.email} | role="${user.role}" → NO MAPPING (unknown role)`);
      errors++;
      continue;
    }

    if (user.role === newRole) {
      console.log(`  → ${user.email} | role="${user.role}" (already correct, skipped)`);
      skipped++;
      continue;
    }

    if (!validKeys.has(newRole)) {
      console.error(`  ✗ ${user.email} | role="${user.role}" → "${newRole}" (target role not in DB!)`);
      errors++;
      continue;
    }

    await db.user.update({
      where: { id: user.id },
      data: { role: newRole },
    });
    console.log(`  ✓ ${user.email} | role="${user.role}" → "${newRole}" (migrated)`);
    migrated++;
  }

  console.log('');
  console.log('━'.repeat(60));
  console.log(`Migration complete. Migrated: ${migrated} · Skipped: ${skipped} · Errors: ${errors}`);
  console.log('━'.repeat(60));

  // Summary
  console.log('');
  console.log('=== Final User.role state ===');
  const updatedUsers = await db.user.findMany({ select: { email: true, name: true, role: true }, orderBy: { role: 'asc' } });
  for (const u of updatedUsers) {
    console.log(`  ${u.role} | ${u.email} (${u.name})`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
