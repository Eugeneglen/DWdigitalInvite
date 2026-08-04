/**
 * Pre-dev health check — ensures DB has data before starting Next.js.
 * If User table is empty, runs both seed scripts automatically.
 * This prevents the recurring "DB wiped" issue in sandbox.
 */
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');
const path = require('path');

async function main() {
  const db = new PrismaClient();
  try {
    const count = await db.user.count();
    if (count === 0) {
      console.warn('[pre-dev-check] DB is empty — seeding...');
      const root = path.resolve(__dirname, '..');
      execSync('bunx tsx prisma/seed.ts', { cwd: root, stdio: 'inherit' });
      execSync('bunx tsx scripts/seed-content-templates.ts', { cwd: root, stdio: 'inherit' });
      console.warn('[pre-dev-check] DB restored successfully.');
    } else {
      console.log(`[pre-dev-check] DB OK (${count} users).`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error('[pre-dev-check] FAILED — starting dev server anyway:', e.message);
  // Don't block dev server startup on seed failure
});
