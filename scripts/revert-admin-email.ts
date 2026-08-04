import { db } from '../src/lib/db';

const OLD_EMAIL = 'gleneugene@gmail.com';  // the temp email we set
const NEW_EMAIL = 'admin@dreamweavers.sg'; // back to the original

async function main() {
  const admin = await db.user.findUnique({ where: { email: OLD_EMAIL } });
  if (!admin) {
    console.error(`✗ Could not find user with email ${OLD_EMAIL}.`);
    console.error(`  Maybe it was already reverted, or never updated in the first place.`);
    process.exit(1);
  }

  const collision = await db.user.findUnique({ where: { email: NEW_EMAIL } });
  if (collision && collision.id !== admin.id) {
    console.error(`✗ Another user already uses ${NEW_EMAIL}. Aborting.`);
    process.exit(1);
  }

  const updated = await db.user.update({
    where: { id: admin.id },
    data: { email: NEW_EMAIL },
  });
  console.log(`✓ Admin email reverted.`);
  console.log(`  Before: ${OLD_EMAIL}`);
  console.log(`  After:  ${updated.email}`);
  console.log(`  (Login: ${NEW_EMAIL} / Admin@2024)`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
