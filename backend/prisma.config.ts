import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Not using env() here on purpose: `prisma generate` runs on `npm install`
    // and must work even before the .env file exists.
    url: process.env.DATABASE_URL ?? '',
  },
});
