import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db, pool } from './db/client';

// Runs pending migrations (including the custom seq/trigger one) and exits.
// Invoked by the container entrypoint before the server starts, and reusable by
// tests. Uses drizzle-orm's runtime migrator so drizzle-kit isn't needed in the
// production image.
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: `${__dirname}/../migrations` });
}

if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('migration failed', e);
      process.exit(1);
    });
}
