import { Hono, type Context } from 'hono';

import { requireAuth, type AppEnv } from '../auth/middleware';
import { rateLimit } from '../middleware/rate-limit';
import { dispatchRoundShareNotifications } from '../notifications/dispatch';
import type {
  JournalResponse,
  RoundUpsertRequest,
  ShotDeleteRequest,
  ShotUpsertRequest,
  WireRow,
} from '../wire';
import {
  DataError,
  deleteJournalEntry,
  deletePutt,
  deleteRound,
  deleteShot,
  getRoundFull,
  getSettings,
  getStatsBundle,
  listCourses,
  listJournal,
  listRounds,
  putPutt,
  putSetting,
  upsertCourse,
  upsertGoals,
  upsertHole,
  upsertJournalEntry,
  upsertReview,
  upsertRound,
  upsertShot,
  upsertTee,
} from './service';

export const dataRoutes = new Hono<AppEnv>();

dataRoutes.use('*', requireAuth);
// Sized for the worst case: a fully-offline 18-hole round replays a couple
// hundred sequential commands when connectivity returns.
dataRoutes.use(
  '*',
  rateLimit({ name: 'data', windowMs: 60_000, max: 600, key: (c) => c.get('userId') }),
);

// Service-level 4xx (bad body, missing identity, not found) → JSON error.
dataRoutes.onError((err, c) => {
  if (err instanceof DataError) return c.json({ error: err.message }, err.status);
  throw err;
});

async function jsonBody(c: Context<AppEnv>): Promise<WireRow> {
  const body = await c.req.json<WireRow>().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new DataError('JSON object body required');
  }
  return body;
}

function holeNumberParam(raw: string): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 36) throw new DataError('invalid hole number');
  return n;
}

// --- Reads -------------------------------------------------------------------

dataRoutes.get('/rounds', async (c) => c.json(await listRounds(c.get('userId'))));

dataRoutes.get('/rounds/:id/full', async (c) =>
  c.json(await getRoundFull(c.get('userId'), c.req.param('id'))),
);

dataRoutes.get('/stats', async (c) => c.json(await getStatsBundle(c.get('userId'))));

dataRoutes.get('/courses', async (c) => c.json(await listCourses(c.get('userId'))));

dataRoutes.get('/journal', async (c) =>
  c.json<JournalResponse>({ entries: await listJournal(c.get('userId')) }),
);

dataRoutes.get('/settings', async (c) => c.json(await getSettings(c.get('userId'))));

// --- Writes ------------------------------------------------------------------
//
// Every write is an idempotent upsert/delete keyed by client UUID: the offline
// outbox replays commands in order, and replaying any of them is a no-op.

dataRoutes.put('/rounds/:id', async (c) => {
  const userId = c.get('userId');
  const body = (await jsonBody(c)) as RoundUpsertRequest;
  await upsertRound(userId, c.req.param('id'), body);
  // A round that just landed completed may notify the owner's friends. The
  // ledger inside makes this idempotent; fire-and-forget keeps latency flat.
  if (typeof body.completed_at === 'string' && body.completed_at) {
    void dispatchRoundShareNotifications(userId);
  }
  return c.json({ ok: true });
});

dataRoutes.delete('/rounds/:id', async (c) => {
  await deleteRound(c.get('userId'), c.req.param('id'));
  return c.json({ ok: true });
});

dataRoutes.put('/rounds/:rid/holes/:n', async (c) => {
  const n = holeNumberParam(c.req.param('n'));
  await upsertHole(c.get('userId'), c.req.param('rid'), n, await jsonBody(c));
  return c.json({ ok: true });
});

dataRoutes.put('/rounds/:rid/holes/:n/shots/:shotType', async (c) => {
  const n = holeNumberParam(c.req.param('n'));
  const { hole, ...shot } = (await jsonBody(c)) as ShotUpsertRequest;
  await upsertShot(c.get('userId'), c.req.param('rid'), n, c.req.param('shotType'), shot, hole);
  return c.json({ ok: true });
});

dataRoutes.delete('/rounds/:rid/holes/:n/shots/:shotType', async (c) => {
  const n = holeNumberParam(c.req.param('n'));
  // DELETE may carry an optional hole patch (e.g. clearing gir when the
  // approach shot is removed); an empty/absent body is fine.
  const body: ShotDeleteRequest = (await c.req.json<ShotDeleteRequest>().catch(() => ({}))) ?? {};
  await deleteShot(c.get('userId'), c.req.param('rid'), n, c.req.param('shotType'), body.hole);
  return c.json({ ok: true });
});

dataRoutes.put('/putts/:id', async (c) => {
  await putPutt(c.get('userId'), c.req.param('id'), await jsonBody(c));
  return c.json({ ok: true });
});

dataRoutes.delete('/putts/:id', async (c) => {
  await deletePutt(c.get('userId'), c.req.param('id'));
  return c.json({ ok: true });
});

dataRoutes.put('/rounds/:rid/review', async (c) => {
  await upsertReview(c.get('userId'), c.req.param('rid'), await jsonBody(c));
  return c.json({ ok: true });
});

dataRoutes.put('/rounds/:rid/goals', async (c) => {
  await upsertGoals(c.get('userId'), c.req.param('rid'), await jsonBody(c));
  return c.json({ ok: true });
});

dataRoutes.put('/journal/:id', async (c) => {
  await upsertJournalEntry(c.get('userId'), c.req.param('id'), await jsonBody(c));
  return c.json({ ok: true });
});

dataRoutes.delete('/journal/:id', async (c) => {
  await deleteJournalEntry(c.get('userId'), c.req.param('id'));
  return c.json({ ok: true });
});

dataRoutes.put('/settings/:key', async (c) => {
  const body = await jsonBody(c);
  if (typeof body.value !== 'string') throw new DataError('value (string) required');
  await putSetting(c.get('userId'), c.req.param('key'), body.value);
  return c.json({ ok: true });
});

dataRoutes.put('/courses/:id', async (c) => {
  await upsertCourse(c.get('userId'), c.req.param('id'), await jsonBody(c));
  return c.json({ ok: true });
});

dataRoutes.put('/tees/:id', async (c) => {
  await upsertTee(c.get('userId'), c.req.param('id'), await jsonBody(c));
  return c.json({ ok: true });
});
