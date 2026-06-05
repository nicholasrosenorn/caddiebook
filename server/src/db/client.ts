import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { env } from '../env';
import { schema } from './schema';

// node-postgres returns bigint (int8) as a string by default to avoid precision
// loss. server_seq fits comfortably in a JS number for this app's volume, so
// parse int8 (OID 20) back to a number for ergonomic cursor math.
pg.types.setTypeParser(20, (v) => Number.parseInt(v, 10));

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

export const db = drizzle(pool, { schema });

export type Db = typeof db;
