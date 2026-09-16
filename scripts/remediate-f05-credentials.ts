/**
 * R-05 / F-05 / F-10 one-time credential remediation.
 *
 * The development database (db/custom.db) was committed to a PUBLIC GitHub
 * repository (dangling commit dbba17f + local branch history) together with
 * the known default passwords (Admin@2024, Couple@2024, Staff@2024). Every
 * account using a predictable password is therefore treated as compromised.
 *
 * This script, run against the LOCAL DEV DATABASE only:
 *   1. Replaces the password of every known seeded account with a freshly
 *      generated cryptographically secure password (printed ONCE below).
 *   2. Sets mustChangePassword=true so each account is forced to set its own
 *      password at next login.
 *   3. Removes the SystemSetting `default_couple_password` (predictable
 *      shared default) — new couple accounts now get per-wedding generated
 *      passwords from /api/master/weddings.
 *
 * Usage: bunx tsx scripts/remediate-f05-credentials.ts
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const SEED_ACCOUNTS = [
  { email: 'admin@dreamweavers.sg', label: 'Super Admin' },
  { email: 'eugeneglen@gmail.com', label: 'Backup Super Admin' },
  { email: 'eleanor@wedding.com', label: 'Couple (demo)' },
  { email: 'consultant@dreamweavers.sg', label: 'Consultant (demo)' },
  { email: 'coordinator@dreamweavers.sg', label: 'Coordinator (demo)' },
];

function generatePassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;
  const pick = (set: string): string => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

async function main() {
  console.log('━'.repeat(60));
  console.log('R-05 credential remediation (local dev database)');
  console.log('━'.repeat(60));

  const newCredentials: Array<{ email: string; label: string; password: string }> = [];

  for (const acct of SEED_ACCOUNTS) {
    const user = await db.user.findUnique({ where: { email: acct.email } });
    if (!user) {
      console.log(`↷ ${acct.email}: not present — skipped`);
      continue;
    }
    const password = generatePassword();
    const passwordHash = await bcrypt.hash(password, 12);
    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        mustChangePassword: true,
      },
    });
    newCredentials.push({ email: acct.email, label: acct.label, password });
    console.log(`✅ ${acct.email}: password rotated (forced change on next login)`);
  }

  const removed = await db.systemSetting.deleteMany({ where: { key: 'default_couple_password' } });
  console.log(removed.count > 0
    ? '✅ SystemSetting default_couple_password removed (new couples get generated passwords)'
    : '↷ SystemSetting default_couple_password already absent');

  console.log('');
  console.log('NEW LOCAL DEV CREDENTIALS (shown once — change at first login):');
  for (const c of newCredentials) {
    console.log(`  ${c.label.padEnd(22)} ${c.email.padEnd(30)} ${c.password}`);
  }
  console.log('');
  console.log('NOTE: production (Railway) secrets and passwords must be rotated');
  console.log('      separately by the operator — this script only touches the');
  console.log('      local development database.');

  await db.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Remediation failed:', e);
    process.exit(1);
  });
