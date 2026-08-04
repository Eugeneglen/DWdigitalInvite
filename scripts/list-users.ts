import { db } from '../src/lib/db';
const users = await db.user.findMany({ select: { email: true, name: true, role: true }});
console.log(JSON.stringify(users, null, 2));
process.exit(0);
