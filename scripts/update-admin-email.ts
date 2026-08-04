import { db } from '../src/lib/db';

const NEW_EMAIL = 'gleneugene@gmail.com';
const OLD_EMAIL = 'admin@dreamweavers.sg';

async function main() {
  // 1) Find the admin user
  const admin = await db.user.findUnique({ where: { email: OLD_EMAIL } });
  if (!admin) {
    console.error(`✗ Could not find user with email ${OLD_EMAIL}. Aborting.`);
    process.exit(1);
  }
  console.log(`Found admin user: id=${admin.id} name="${admin.name}" email=${admin.email} role=${admin.role}`);

  // 2) Make sure no other user is already using the new email (collision check)
  const existing = await db.user.findUnique({ where: { email: NEW_EMAIL } });
  if (existing && existing.id !== admin.id) {
    console.error(`✗ Another user already uses ${NEW_EMAIL} (id=${existing.id}). Aborting to avoid duplicate.`);
    process.exit(1);
  }

  // 3) Update the email
  const updated = await db.user.update({
    where: { id: admin.id },
    data: { email: NEW_EMAIL },
  });
  console.log(`✓ Admin email updated successfully.`);
  console.log(`  Before: ${OLD_EMAIL}`);
  console.log(`  After:  ${updated.email}`);
  console.log(`  (Password is unchanged. Login with ${NEW_EMAIL} / Admin@2024)`);

  // 4) Print verification
  const verify = await db.user.findUnique({ where: { email: NEW_EMAIL } });
  console.log(`\nVerification — record read back from DB:`);
  console.log(JSON.stringify({
    id: verify?.id,
    name: verify?.name,
    email: verify?.email,
    role: verify?.role,
  }, null, 2));

  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
