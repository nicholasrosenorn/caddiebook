import * as SQLite from 'expo-sqlite';

import { pushChanges } from '@/lib/api/client';
import type { WireChange } from '@/lib/api/types';
import { getPref, setPref } from '@/lib/local/prefs';

// One-time upgrade path from the local-first SQLite era. Earlier builds kept
// every table on-device with a `dirty` flag for the (now removed) sync engine.
// On the first run of this build we: (1) copy the device prefs that used to
// live in the sqlite app_settings (theme, intro flag) into AsyncStorage, and
// (2) once signed in, push any rows the old engine never delivered through the
// retained /sync/push, then delete the database file for good.
//
// expo-sqlite stays a dependency for exactly this module; both it and the
// /sync endpoints go away once existing installs have upgraded.

const DB_NAME = 'caddy-book.db';
const PREFS_FLAG = 'legacy_prefs_migrated_v1';
const FLUSH_FLAG = 'legacy_flush_done_v1';

// Frozen copy of the old schema's syncable tables (push order: parents first).
const LEGACY_TABLES = [
  'rounds',
  'courses',
  'tees',
  'holes',
  'shots',
  'putts',
  'post_round_reviews',
  'pre_round_goals',
  'journal_entries',
  'app_settings',
] as const;

// Settings keys that moved to device-local prefs.
const PREF_KEYS = ['theme', 'intro_seen'];

async function openLegacyDb(): Promise<SQLite.SQLiteDatabase | null> {
  // openDatabaseAsync creates an empty file if none exists, so "is this a real
  // legacy database" is decided by whether the old tables are in it.
  try {
    const db = await SQLite.openDatabaseAsync(DB_NAME);
    const hasTables = await db.getFirstAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'rounds';`,
    );
    if (!hasTables) {
      await db.closeAsync();
      return null;
    }
    return db;
  } catch {
    return null;
  }
}

// Copy theme + intro_seen out of the old sqlite settings into AsyncStorage.
// Runs at cold start (no auth needed) so existing users keep their theme and
// never see the intro again. Safe to call every launch — flag-gated.
export async function migrateLegacyPrefs(): Promise<void> {
  if ((await getPref(PREFS_FLAG)) === '1') return;
  const db = await openLegacyDb();
  if (db) {
    try {
      for (const key of PREF_KEYS) {
        const row = await db.getFirstAsync<{ value: string | null }>(
          `SELECT value FROM app_settings WHERE key = ? AND deleted_at IS NULL;`,
          [key],
        );
        if (row?.value != null && (await getPref(key)) == null) {
          await setPref(key, row.value);
        }
      }
    } catch (err) {
      console.warn('[legacy-flush] pref migration failed', err);
    } finally {
      await db.closeAsync().catch(() => {});
    }
  }
  await setPref(PREFS_FLAG, '1');
}

let flushPromise: Promise<void> | null = null;

// Push the old database's undelivered rows to the server, then delete the file.
// Requires a session (uses the authed /sync/push). Idempotent and self-deduping;
// a failure (offline) leaves everything in place for the next launch.
export function ensureLegacyFlush(): Promise<void> {
  flushPromise ??= runFlush().finally(() => {
    flushPromise = null;
  });
  return flushPromise;
}

async function runFlush(): Promise<void> {
  try {
    if ((await getPref(FLUSH_FLAG)) === '1') return;
    await migrateLegacyPrefs();

    const db = await openLegacyDb();
    if (!db) {
      // Fresh install (or already-deleted db): nothing to flush.
      await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => {});
      await setPref(FLUSH_FLAG, '1');
      return;
    }

    const changes: WireChange[] = [];
    try {
      for (const table of LEGACY_TABLES) {
        const rows = await db.getAllAsync<Record<string, string | number | null>>(
          `SELECT * FROM ${table} WHERE dirty = 1;`,
        );
        for (const { dirty: _dirty, ...row } of rows) {
          changes.push({ table, row });
        }
      }
    } finally {
      await db.closeAsync().catch(() => {});
    }

    // The push must land before the file is deleted — these rows exist nowhere
    // else. Throws when offline; we retry on a later launch.
    if (changes.length > 0) await pushChanges(changes);

    await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => {});
    await setPref(FLUSH_FLAG, '1');
  } catch (err) {
    console.warn('[legacy-flush] will retry next launch', err);
  }
}
