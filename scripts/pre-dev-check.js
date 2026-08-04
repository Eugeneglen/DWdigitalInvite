/**
 * Pre-dev health check — ensures .env and DB are healthy before starting Next.js.
 *
 * 1. Ensures NEXTAUTH_SECRET and NEXTAUTH_URL are in .env (sandbox wipes .env
 *    periodically, which breaks JWT encode → all logins fail with
 *    "ikm must be at least one byte in length").
 * 2. If the User table is empty, runs seed scripts to restore data.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const ENV_PATH = path.resolve(__dirname, '..', '.env');

function healEnv() {
  let content = '';
  let needsWrite = false;

  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  const lines = content.split('\n');
  const keys = {};
  for (const line of lines) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) keys[m[1]] = m[2];
  }

  // Ensure DATABASE_URL
  if (!keys.DATABASE_URL) {
    keys.DATABASE_URL = 'file:' + path.resolve(__dirname, '..', 'db', 'custom.db');
    console.warn('[pre-dev-check] Adding DATABASE_URL to .env');
    needsWrite = true;
  }

  // Ensure NEXTAUTH_SECRET — generate one if missing (deterministic for local dev
  // so sessions survive pre-dev-check re-runs)
  if (!keys.NEXTAUTH_SECRET) {
    keys.NEXTAUTH_SECRET = crypto.randomBytes(32).toString('base64');
    console.warn('[pre-dev-check] Generated NEXTAUTH_SECRET for .env');
    needsWrite = true;
  }

  // Ensure NEXTAUTH_URL
  if (!keys.NEXTAUTH_URL) {
    keys.NEXTAUTH_URL = 'http://localhost:3000';
    console.warn('[pre-dev-check] Adding NEXTAUTH_URL to .env');
    needsWrite = true;
  }

  if (needsWrite) {
    const out = Object.entries(keys).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    fs.writeFileSync(ENV_PATH, out);
    console.warn('[pre-dev-check] .env healed (missing keys restored)');
  } else {
    console.log('[pre-dev-check] .env OK');
  }

  // Also inject into process.env so the current process picks them up
  process.env.DATABASE_URL = keys.DATABASE_URL;
  process.env.NEXTAUTH_SECRET = keys.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_URL = keys.NEXTAUTH_URL;
}

async function healDb() {
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

async function main() {
  console.log('[pre-dev-check] Running health checks...');
  healEnv();
  await healDb();
}

main().catch((e) => {
  console.error('[pre-dev-check] FAILED — starting dev server anyway:', e.message);
});
