import { db } from '../src/lib/db';
const u = await db.user.findUnique({ where: { email: 'admin@dreamweavers.sg' } });
console.log('Admin user record:');
console.log(JSON.stringify({ id: u?.id, name: u?.name, email: u?.email, role: u?.role }, null, 2));
process.exit(0);
