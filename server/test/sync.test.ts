import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { signAccessToken } from '../src/auth/jwt';
import { pool } from '../src/db/client';
import { runMigrations } from '../src/migrate';
import type { PullResponse, PushResponse, WireChange, WireRow } from '../src/wire';

const app = createApp();

beforeAll(async () => {
  await runMigrations();
});

afterAll(async () => {
  await pool.end();
});

async function push(userId: string, changes: WireChange[]): Promise<Response> {
  const token = await signAccessToken(userId);
  return app.request('/sync/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes }),
  });
}

async function pull(userId: string, since = 0): Promise<PullResponse> {
  const token = await signAccessToken(userId);
  const res = await app.request(`/sync/pull?since=${since}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(200);
  return (await res.json()) as PullResponse;
}

function roundRow(id: string, updatedAt: string, extra: WireRow = {}): WireChange {
  return {
    table: 'rounds',
    row: {
      id,
      course_name: 'Test Links',
      date_played: '2026-06-05',
      hole_count: 18,
      created_at: '2026-06-05 12:00:00',
      updated_at: updatedAt,
      deleted_at: null,
      ...extra,
    },
  };
}

function findRound(res: PullResponse, id: string): WireRow | undefined {
  return res.changes.find((ch) => ch.table === 'rounds' && ch.row.id === id)?.row;
}

describe('sync', () => {
  it('round-trips a round + its holes and putts', async () => {
    const user = randomUUID();
    const roundId = randomUUID();
    const changes: WireChange[] = [
      roundRow(roundId, '2026-06-05 13:00:00'),
      {
        table: 'holes',
        row: {
          id: randomUUID(),
          round_id: roundId,
          hole_number: 1,
          par: 4,
          score: 5,
          updated_at: '2026-06-05 13:00:01',
          deleted_at: null,
        },
      },
      {
        table: 'putts',
        row: {
          id: randomUUID(),
          round_id: roundId,
          hole_number: 1,
          distance_ft: 10,
          made: 1,
          created_at: '2026-06-05 13:00:02',
          updated_at: '2026-06-05 13:00:02',
          deleted_at: null,
        },
      },
    ];
    const res = await push(user, changes);
    expect(res.status).toBe(200);
    expect(((await res.json()) as PushResponse).applied).toBe(3);

    const pulled = await pull(user);
    expect(pulled.changes).toHaveLength(3);
    expect(findRound(pulled, roundId)?.course_name).toBe('Test Links');
    expect(pulled.changes.some((ch) => ch.table === 'holes')).toBe(true);
    expect(pulled.changes.some((ch) => ch.table === 'putts')).toBe(true);
    // changes must be ordered by server_seq (cursor is monotonic).
    expect(pulled.nextCursor).toBeGreaterThan(0);
  });

  it('applies last-write-wins by updated_at', async () => {
    const user = randomUUID();
    const id = randomUUID();

    await push(user, [roundRow(id, '2026-06-05 10:00:02', { course_name: 'NEWER' })]);
    // Older write must be ignored.
    await push(user, [roundRow(id, '2026-06-05 10:00:01', { course_name: 'OLDER' })]);
    expect(findRound(await pull(user), id)?.course_name).toBe('NEWER');

    // Strictly newer write wins.
    await push(user, [roundRow(id, '2026-06-05 10:00:03', { course_name: 'NEWEST' })]);
    expect(findRound(await pull(user), id)?.course_name).toBe('NEWEST');
  });

  it('propagates tombstones', async () => {
    const user = randomUUID();
    const id = randomUUID();
    await push(user, [roundRow(id, '2026-06-05 09:00:00')]);
    await push(user, [
      roundRow(id, '2026-06-05 09:00:01', { deleted_at: '2026-06-05 09:00:01' }),
    ]);
    const row = findRound(await pull(user), id);
    expect(row?.deleted_at).toBe('2026-06-05 09:00:01');
  });

  it('isolates users', async () => {
    const userA = randomUUID();
    const userB = randomUUID();
    const id = randomUUID();

    await push(userA, [roundRow(id, '2026-06-05 08:00:00', { course_name: 'A-owned' })]);
    // B can't see A's row...
    expect(findRound(await pull(userB), id)).toBeUndefined();
    // ...and B writing the same id can't overwrite A's row (composite PK).
    await push(userB, [roundRow(id, '2026-06-05 23:59:59', { course_name: 'B-owned' })]);
    expect(findRound(await pull(userA), id)?.course_name).toBe('A-owned');
    expect(findRound(await pull(userB), id)?.course_name).toBe('B-owned');
  });

  it('rejects unauthenticated requests', async () => {
    const noAuth = await app.request('/sync/pull?since=0');
    expect(noAuth.status).toBe(401);
    const badAuth = await app.request('/sync/pull?since=0', {
      headers: { Authorization: 'Bearer not-a-real-token' },
    });
    expect(badAuth.status).toBe(401);
  });
});
