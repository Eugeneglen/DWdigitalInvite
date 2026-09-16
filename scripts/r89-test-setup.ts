/**
 * R-08/R-09 VERIFICATION TEST DATA SETUP (local dev only)
 *
 * Creates dedicated test personas for the brute-force and session-revocation
 * verification battery. Test-only accounts with a known strong password that
 * is NOT a production default pattern. These accounts exist solely for live
 * testing and are flagged mustChangePassword=false / named r89test-*.
 *
 * Usage: bunx tsx scripts/r89-test-setup.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const TEST_PASSWORD = 'R89-Verify-' + Math.random().toString(36).slice(2, 10) + '!a9';

async function ensureUser(email: string, name: string, role: string) {
  const existing = await db.user.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        role,
        name,
        isActive: true,
        mustChangePassword: false,
        resetToken: null,
        resetTokenExpiry: null,
        sessionVersion: 0,
      },
    });
  }
  return db.user.create({
    data: { email, name, role, passwordHash, isActive: true, mustChangePassword: false },
  });
}

async function main() {
  const admin = await ensureUser('r89test-admin@test.local', 'R89 Test Admin', 'SUPER_ADMIN_1');
  const couple = await ensureUser('r89test-couple@test.local', 'R89 Test Couple', 'COUPLE');
  const staff = await ensureUser('r89test-staff@test.local', 'R89 Test Staff', 'CONSULTANT_1');
  const viewer = await ensureUser('r89test-viewer@test.local', 'R89 Test Viewer', 'SUPPORT_1');

  // Ensure the test couple owns a wedding (login requires an ACTIVE account;
  // couple login path checks wedding status)
  let wedding = await db.weddingAccount.findFirst({ where: { ownerId: couple.id } });
  if (!wedding) {
    wedding = await db.weddingAccount.create({
      data: {
        slug: 'r89-test-wedding',
        coupleName: 'R89 Test Couple',
        weddingDate: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        status: 'ACTIVE',
        accountStatus: 'ACTIVE',
        ownerId: couple.id,
      },
    });
  } else if (wedding.accountStatus !== 'ACTIVE') {
    await db.weddingAccount.update({ where: { id: wedding.id }, data: { accountStatus: 'ACTIVE', status: 'ACTIVE' } });
  }

  console.log(JSON.stringify({
    adminId: admin.id,
    coupleId: couple.id,
    staffId: staff.id,
    viewerId: viewer.id,
    weddingId: wedding.id,
    // Printed once for the test harness only — test accounts, not production.
    testPassword: TEST_PASSWORD,
  }, null, 2));
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
