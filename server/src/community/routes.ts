import { and, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { db } from '../db/client';
import { pool } from '../db/client';
import { friendRequests, friendships, roundLikes, users } from '../db/schema';
import { requireAuth, type AppEnv } from '../auth/middleware';
import { rateLimit } from '../middleware/rate-limit';
import type {
  AcceptResponse,
  FeedResponse,
  FriendRoundDetail,
  FriendsResponse,
  IncomingRequestsResponse,
  LikeResponse,
  PublicProfile,
  Relation,
  RequestCountResponse,
  RoundLikersResponse,
  SendRequestResponse,
  UserSearchResponse,
  UserSearchResult,
  WireHole,
} from '../wire';

type UserRow = typeof users.$inferSelect;

function toPublicProfile(u: Pick<UserRow, 'id' | 'username' | 'firstName' | 'lastName' | 'avatar'>): PublicProfile {
  return {
    id: u.id,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    avatar: u.avatar,
  };
}

// Friendships are stored once with user_low < user_high (string compare on the
// uuid). Order any pair the same way before reading/writing.
function orderPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

async function areFriends(a: string, b: string): Promise<boolean> {
  const { low, high } = orderPair(a, b);
  const rows = await db
    .select({ low: friendships.userLow })
    .from(friendships)
    .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    .limit(1);
  return rows.length > 0;
}

export const communityRoutes = new Hono<AppEnv>();

communityRoutes.use('*', requireAuth);
// Generous per-user cap for reads; a tighter cap on writes (search + requests)
// to blunt enumeration / friend-request spam.
communityRoutes.use('*', rateLimit({ name: 'community', windowMs: 60_000, max: 120, key: (c) => c.get('userId') }));
const writeLimit = rateLimit({ name: 'community-write', windowMs: 60_000, max: 30, key: (c) => c.get('userId') });

// GET /community/users/search?q= — prefix match on username, excluding self.
communityRoutes.get('/users/search', writeLimit, async (c) => {
  const me = c.get('userId');
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  if (q.length < 2) return c.json<UserSearchResponse>({ users: [] });

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      avatar: users.avatar,
    })
    .from(users)
    .where(and(ilike(users.username, `${q}%`), ne(users.id, me)))
    .limit(10);
  if (rows.length === 0) return c.json<UserSearchResponse>({ users: [] });

  // Friendships involving me where the other side is in the result set.
  const friendRows = await db
    .select({ low: friendships.userLow, high: friendships.userHigh })
    .from(friendships)
    .where(or(eq(friendships.userLow, me), eq(friendships.userHigh, me)));
  const friendIds = new Set(friendRows.map((f) => (f.low === me ? f.high : f.low)));

  const sent = await db
    .select({ to: friendRequests.toUserId })
    .from(friendRequests)
    .where(and(eq(friendRequests.fromUserId, me), eq(friendRequests.status, 'pending')));
  const sentTo = new Set(sent.map((r) => r.to));

  const received = await db
    .select({ from: friendRequests.fromUserId })
    .from(friendRequests)
    .where(and(eq(friendRequests.toUserId, me), eq(friendRequests.status, 'pending')));
  const receivedFrom = new Set(received.map((r) => r.from));

  const out: UserSearchResult[] = rows.map((r) => {
    let relation: Relation = 'none';
    if (friendIds.has(r.id)) relation = 'friends';
    else if (sentTo.has(r.id)) relation = 'request_sent';
    else if (receivedFrom.has(r.id)) relation = 'request_received';
    return { ...toPublicProfile(r), relation };
  });
  return c.json<UserSearchResponse>({ users: out });
});

// POST /community/friend-requests { username } — send (or auto-accept a reverse).
communityRoutes.post('/friend-requests', writeLimit, async (c) => {
  const me = c.get('userId');
  const body = (await c.req.json().catch(() => null)) as { username?: string } | null;
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (!username) return c.json({ error: 'username required' }, 400);

  const target = (await db.select().from(users).where(eq(users.username, username)).limit(1))[0];
  if (!target) return c.json({ error: 'user not found' }, 404);
  if (target.id === me) return c.json({ error: 'cannot friend yourself' }, 400);
  if (await areFriends(me, target.id)) return c.json({ error: 'already friends' }, 409);

  // Reverse-direction pending request → accept it instead of stacking a new one.
  const reverse = (
    await db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.fromUserId, target.id),
          eq(friendRequests.toUserId, me),
          eq(friendRequests.status, 'pending'),
        ),
      )
      .limit(1)
  )[0];
  if (reverse) {
    const { low, high } = orderPair(me, target.id);
    await db.transaction(async (tx) => {
      await tx.delete(friendRequests).where(eq(friendRequests.id, reverse.id));
      await tx.insert(friendships).values({ userLow: low, userHigh: high }).onConflictDoNothing();
    });
    return c.json<SendRequestResponse>({ status: 'accepted', friend: toPublicProfile(target) });
  }

  // Same-direction pending → idempotent; else insert (race-safe via unique pair).
  await db
    .insert(friendRequests)
    .values({ fromUserId: me, toUserId: target.id })
    .onConflictDoNothing();
  return c.json<SendRequestResponse>({ status: 'pending' });
});

// GET /community/friend-requests/incoming — pending requests addressed to me.
communityRoutes.get('/friend-requests/incoming', async (c) => {
  const me = c.get('userId');
  const rows = await db
    .select({
      id: friendRequests.id,
      createdAt: friendRequests.createdAt,
      uId: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      avatar: users.avatar,
    })
    .from(friendRequests)
    .innerJoin(users, eq(users.id, friendRequests.fromUserId))
    .where(and(eq(friendRequests.toUserId, me), eq(friendRequests.status, 'pending')))
    .orderBy(sql`${friendRequests.createdAt} DESC`);
  return c.json<IncomingRequestsResponse>({
    requests: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      from: toPublicProfile({
        id: r.uId,
        username: r.username,
        firstName: r.firstName,
        lastName: r.lastName,
        avatar: r.avatar,
      }),
    })),
  });
});

// GET /community/friend-requests/count — cheap badge count.
communityRoutes.get('/friend-requests/count', async (c) => {
  const me = c.get('userId');
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendRequests)
    .where(and(eq(friendRequests.toUserId, me), eq(friendRequests.status, 'pending')));
  return c.json<RequestCountResponse>({ count: rows[0]?.n ?? 0 });
});

// POST /community/friend-requests/:id/accept
communityRoutes.post('/friend-requests/:id/accept', async (c) => {
  const me = c.get('userId');
  const id = c.req.param('id');
  const req = (await db.select().from(friendRequests).where(eq(friendRequests.id, id)).limit(1))[0];
  if (!req || req.toUserId !== me || req.status !== 'pending') {
    return c.json({ error: 'request not found' }, 404);
  }
  const { low, high } = orderPair(req.fromUserId, req.toUserId);
  await db.transaction(async (tx) => {
    await tx.delete(friendRequests).where(eq(friendRequests.id, id));
    await tx.insert(friendships).values({ userLow: low, userHigh: high }).onConflictDoNothing();
  });
  const friend = (await db.select().from(users).where(eq(users.id, req.fromUserId)).limit(1))[0];
  return c.json<AcceptResponse>({ ok: true, friend: toPublicProfile(friend!) });
});

// POST /community/friend-requests/:id/decline — delete so a re-request is possible.
communityRoutes.post('/friend-requests/:id/decline', async (c) => {
  const me = c.get('userId');
  const id = c.req.param('id');
  const req = (await db.select().from(friendRequests).where(eq(friendRequests.id, id)).limit(1))[0];
  if (!req || req.toUserId !== me || req.status !== 'pending') {
    return c.json({ error: 'request not found' }, 404);
  }
  await db.delete(friendRequests).where(eq(friendRequests.id, id));
  return c.json({ ok: true });
});

// GET /community/friends
communityRoutes.get('/friends', async (c) => {
  const me = c.get('userId');
  const rows = await db
    .select({ low: friendships.userLow, high: friendships.userHigh })
    .from(friendships)
    .where(or(eq(friendships.userLow, me), eq(friendships.userHigh, me)));
  const otherIds = rows.map((r) => (r.low === me ? r.high : r.low));
  if (otherIds.length === 0) return c.json<FriendsResponse>({ friends: [] });
  const profiles = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      avatar: users.avatar,
    })
    .from(users)
    .where(inArray(users.id, otherIds));
  return c.json<FriendsResponse>({ friends: profiles.map(toPublicProfile) });
});

// DELETE /community/friends/:friendUserId — unfriend + clean up likes/requests.
communityRoutes.delete('/friends/:friendUserId', async (c) => {
  const me = c.get('userId');
  const other = c.req.param('friendUserId');
  const { low, high } = orderPair(me, other);
  await db.transaction(async (tx) => {
    await tx
      .delete(friendships)
      .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)));
    // Remove likes either user placed on the other's rounds.
    await tx
      .delete(roundLikes)
      .where(
        or(
          and(eq(roundLikes.roundOwnerId, me), eq(roundLikes.likerId, other)),
          and(eq(roundLikes.roundOwnerId, other), eq(roundLikes.likerId, me)),
        ),
      );
    await tx
      .delete(friendRequests)
      .where(
        or(
          and(eq(friendRequests.fromUserId, me), eq(friendRequests.toUserId, other)),
          and(eq(friendRequests.fromUserId, other), eq(friendRequests.toUserId, me)),
        ),
      );
  });
  return c.json({ ok: true });
});

// --- Feed -----------------------------------------------------------------

const HOLE_COLS =
  'id, round_id, hole_number, par, fir, gir, up_and_down, approach_distance_yds, ' +
  'approach_club, drive_club, score, putts, chip_shots, sand_shots, penalties, ' +
  'green_blocked, notes';

const DEFAULT_FEED_LIMIT = 20;
const MAX_FEED_LIMIT = 50;

function encodeCursor(completedAt: string, id: string): string {
  return Buffer.from(`${completedAt}|${id}`, 'utf8').toString('base64');
}
function decodeCursor(cursor: string): { completedAt: string; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const i = raw.lastIndexOf('|');
    if (i < 0) return null;
    return { completedAt: raw.slice(0, i), id: raw.slice(i + 1) };
  } catch {
    return null;
  }
}

function wireHoleFromRow(row: Record<string, unknown>): WireHole {
  return {
    id: row.id as string,
    round_id: row.round_id as string,
    hole_number: row.hole_number as number,
    par: (row.par as number) ?? null,
    fir: (row.fir as number) ?? null,
    gir: (row.gir as number) ?? null,
    up_and_down: (row.up_and_down as number) ?? null,
    approach_distance_yds: (row.approach_distance_yds as number) ?? null,
    approach_club: (row.approach_club as string) ?? null,
    drive_club: (row.drive_club as string) ?? null,
    score: (row.score as number) ?? null,
    putts: (row.putts as number) ?? null,
    chip_shots: (row.chip_shots as number) ?? null,
    sand_shots: (row.sand_shots as number) ?? null,
    penalties: (row.penalties as number) ?? null,
    green_blocked: (row.green_blocked as number) ?? null,
    notes: (row.notes as string) ?? null,
  };
}

// Fetch holes for a page of (owner, round) pairs and group them by round.
async function holesByRound(
  ownerIds: string[],
  roundIds: string[],
): Promise<Map<string, WireHole[]>> {
  const map = new Map<string, WireHole[]>();
  if (roundIds.length === 0) return map;
  const res = await pool.query(
    `SELECT ${HOLE_COLS}, user_id FROM holes
     WHERE user_id = ANY($1) AND round_id = ANY($2) AND deleted_at IS NULL
     ORDER BY round_id, hole_number`,
    [ownerIds, roundIds],
  );
  for (const row of res.rows) {
    const key = `${row.user_id}|${row.round_id}`;
    const arr = map.get(key);
    const hole = wireHoleFromRow(row);
    if (arr) arr.push(hole);
    else map.set(key, [hole]);
  }
  return map;
}

// GET /community/feed?cursor=&limit=
communityRoutes.get('/feed', async (c) => {
  const me = c.get('userId');
  const limit = Math.min(
    Math.max(1, Number.parseInt(c.req.query('limit') ?? '', 10) || DEFAULT_FEED_LIMIT),
    MAX_FEED_LIMIT,
  );
  const cursorRaw = c.req.query('cursor');
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;

  const params: unknown[] = [me];
  let keyset = '';
  if (cursor) {
    params.push(cursor.completedAt, cursor.id);
    keyset = `AND (r.completed_at, r.id) < ($2, $3)`;
  }
  params.push(limit);
  const limitIdx = params.length;

  const res = await pool.query(
    // `authors` = my friends plus me, so the feed shows my own shared rounds
    // interleaved with friends'. The exclude_from_sharing filter still applies
    // uniformly: a round I hid from sharing stays out of my own feed too.
    `WITH authors AS (
       SELECT CASE WHEN user_low = $1 THEN user_high ELSE user_low END AS fid
       FROM friendships WHERE user_low = $1 OR user_high = $1
       UNION
       SELECT $1::uuid
     )
     SELECT r.user_id AS owner_id, r.id, r.course_name, r.date_played, r.hole_count,
            r.completed_at, r.created_at,
            u.username, u.first_name, u.last_name, u.avatar,
            COALESCE(l.cnt, 0)::int AS like_count,
            (ml.liker_id IS NOT NULL) AS liked_by_me
     FROM rounds r
     JOIN authors f ON f.fid = r.user_id
     JOIN users u ON u.id = r.user_id
     LEFT JOIN (
       SELECT round_owner_id, round_id, COUNT(*) AS cnt
       FROM round_likes GROUP BY round_owner_id, round_id
     ) l ON l.round_owner_id = r.user_id AND l.round_id = r.id
     LEFT JOIN round_likes ml
       ON ml.round_owner_id = r.user_id AND ml.round_id = r.id AND ml.liker_id = $1
     WHERE r.deleted_at IS NULL
       AND r.completed_at IS NOT NULL
       AND COALESCE(r.exclude_from_sharing, 0) = 0
       ${keyset}
     ORDER BY r.completed_at DESC, r.id DESC
     LIMIT $${limitIdx}`,
    params,
  );

  const ownerIds = [...new Set(res.rows.map((r) => r.owner_id as string))];
  const roundIds = res.rows.map((r) => r.id as string);
  const holeMap = await holesByRound(ownerIds, roundIds);

  const rounds: FeedResponse['rounds'] = res.rows.map((r) => ({
    ownerId: r.owner_id,
    owner: {
      id: r.owner_id,
      username: r.username,
      firstName: r.first_name,
      lastName: r.last_name,
      avatar: r.avatar,
    },
    id: r.id,
    courseName: r.course_name,
    datePlayed: r.date_played,
    holeCount: r.hole_count,
    completedAt: r.completed_at,
    createdAt: r.created_at,
    holes: holeMap.get(`${r.owner_id}|${r.id}`) ?? [],
    likeCount: r.like_count,
    likedByMe: r.liked_by_me,
  }));

  const last = res.rows[res.rows.length - 1];
  const nextCursor =
    res.rows.length === limit && last
      ? encodeCursor(last.completed_at as string, last.id as string)
      : null;

  return c.json<FeedResponse>({ rounds, nextCursor });
});

// Load a shareable round owned by `ownerId` that `me` is allowed to see, or null.
async function loadShareableRound(
  me: string,
  ownerId: string,
  roundId: string,
): Promise<Record<string, unknown> | null> {
  if (ownerId !== me && !(await areFriends(me, ownerId))) return null;
  const res = await pool.query(
    `SELECT user_id AS owner_id, id, course_name, date_played, hole_count,
            completed_at, created_at
     FROM rounds
     WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       AND completed_at IS NOT NULL AND COALESCE(exclude_from_sharing, 0) = 0`,
    [ownerId, roundId],
  );
  return res.rows[0] ?? null;
}

async function likeAggregate(
  ownerId: string,
  roundId: string,
  me: string,
): Promise<LikeResponse> {
  const res = await pool.query(
    `SELECT COUNT(*)::int AS cnt,
            bool_or(liker_id = $3) AS liked_by_me
     FROM round_likes WHERE round_owner_id = $1 AND round_id = $2`,
    [ownerId, roundId, me],
  );
  return { likeCount: res.rows[0]?.cnt ?? 0, likedByMe: res.rows[0]?.liked_by_me ?? false };
}

// GET /community/rounds/:ownerId/:roundId — read-only detail.
communityRoutes.get('/rounds/:ownerId/:roundId', async (c) => {
  const me = c.get('userId');
  const ownerId = c.req.param('ownerId');
  const roundId = c.req.param('roundId');
  const round = await loadShareableRound(me, ownerId, roundId);
  if (!round) return c.json({ error: 'round not found' }, 404);

  const owner = (
    await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1)
  )[0];

  const holeMap = await holesByRound([ownerId], [roundId]);
  const [shotsRes, puttsRes, reviewRes, goalsRes, likes] = await Promise.all([
    pool.query(
      `SELECT id, round_id, hole_number, shot_type, x_norm, y_norm,
              intended_x_norm, intended_y_norm, notes
       FROM shots WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL`,
      [ownerId, roundId],
    ),
    pool.query(
      `SELECT id, round_id, hole_number, distance_ft, made, created_at
       FROM putts WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL`,
      [ownerId, roundId],
    ),
    pool.query(
      `SELECT id, round_id, most_costly, decision_making_rating, common_miss,
              range_focus, overall_rating
       FROM post_round_reviews WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL`,
      [ownerId, roundId],
    ),
    pool.query(
      `SELECT id, round_id, execution_goal, strategic_goal, mental_goal
       FROM pre_round_goals WHERE user_id = $1 AND round_id = $2 AND deleted_at IS NULL`,
      [ownerId, roundId],
    ),
    likeAggregate(ownerId, roundId, me),
  ]);

  const detail: FriendRoundDetail = {
    ownerId,
    owner: toPublicProfile(owner!),
    id: round.id as string,
    courseName: round.course_name as string,
    datePlayed: round.date_played as string,
    holeCount: round.hole_count as number,
    completedAt: round.completed_at as string,
    createdAt: round.created_at as string,
    holes: holeMap.get(`${ownerId}|${roundId}`) ?? [],
    likeCount: likes.likeCount,
    likedByMe: likes.likedByMe,
    shots: shotsRes.rows as FriendRoundDetail['shots'],
    putts: puttsRes.rows as FriendRoundDetail['putts'],
    review: (reviewRes.rows[0] as FriendRoundDetail['review']) ?? null,
    goals: (goalsRes.rows[0] as FriendRoundDetail['goals']) ?? null,
  };
  return c.json(detail);
});

// GET /community/rounds/:ownerId/:roundId/likes — who liked it, newest first.
communityRoutes.get('/rounds/:ownerId/:roundId/likes', async (c) => {
  const me = c.get('userId');
  const ownerId = c.req.param('ownerId');
  const roundId = c.req.param('roundId');
  const round = await loadShareableRound(me, ownerId, roundId);
  if (!round) return c.json({ error: 'round not found' }, 404);

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      avatar: users.avatar,
    })
    .from(roundLikes)
    .innerJoin(users, eq(users.id, roundLikes.likerId))
    .where(and(eq(roundLikes.roundOwnerId, ownerId), eq(roundLikes.roundId, roundId)))
    .orderBy(desc(roundLikes.createdAt));

  return c.json<RoundLikersResponse>({ likers: rows.map(toPublicProfile) });
});

// POST /community/rounds/:ownerId/:roundId/like
communityRoutes.post('/rounds/:ownerId/:roundId/like', async (c) => {
  const me = c.get('userId');
  const ownerId = c.req.param('ownerId');
  const roundId = c.req.param('roundId');
  const round = await loadShareableRound(me, ownerId, roundId);
  if (!round) return c.json({ error: 'round not found' }, 404);
  await db
    .insert(roundLikes)
    .values({ roundOwnerId: ownerId, roundId, likerId: me })
    .onConflictDoNothing();
  return c.json<LikeResponse>(await likeAggregate(ownerId, roundId, me));
});

// DELETE /community/rounds/:ownerId/:roundId/like
communityRoutes.delete('/rounds/:ownerId/:roundId/like', async (c) => {
  const me = c.get('userId');
  const ownerId = c.req.param('ownerId');
  const roundId = c.req.param('roundId');
  await db
    .delete(roundLikes)
    .where(
      and(
        eq(roundLikes.roundOwnerId, ownerId),
        eq(roundLikes.roundId, roundId),
        eq(roundLikes.likerId, me),
      ),
    );
  return c.json<LikeResponse>(await likeAggregate(ownerId, roundId, me));
});
