import { defineConfig } from 'drizzle-kit';

// Drizzle-kit is the versioned migration runner the project previously lacked.
// `generate` diffs src/db/schema.ts into timestamped SQL under ./migrations;
// `migrate` applies pending ones and records state in __drizzle_migrations.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/caddiebook',
  },
});
