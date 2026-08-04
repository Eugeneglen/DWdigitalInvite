import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  // Location of the Prisma schema file
  schema: path.join(__dirname, 'schema.prisma'),

  // Migrations directory (used by `prisma migrate dev`)
  migrations: {
    path: path.join(__dirname, 'migrations'),
  },
});
