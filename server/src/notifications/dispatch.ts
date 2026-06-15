import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

import { pool } from '../db/client';

// One shared client. Without an access token it uses the public Expo push API,
// which is fine for our volume; EAS handles the APNs/FCM credentials per project.
const expo = new Expo();

// Where a tapped notification lands — the Community feed tab. The client reads
// this off the notification's data payload and router.navigate()s to it.
const COMMUNITY_TAB_URL = '/(tabs)/(community)/community';

// Only rounds completed within this window are candidates. This is what lets the
// claim be released on a failed/no-recipient attempt (see dispatch loop) without
// an old round firing late: a round whose friends never had a token during the
// window simply ages out instead of notifying on some unrelated future event.
const SHARE_WINDOW_MS = 48 * 60 * 60 * 1000;

type PendingRound = { roundId: string; ownerName: string };

// Find the owner's rounds that are completed + shared + recent and have NOT yet
// produced a "friend finished a round" notification. Mirrors the share predicate
// used by loadShareableRound / the feed query in community/routes.ts.
async function findUnnotifiedRounds(ownerId: string): Promise<PendingRound[]> {
  // completed_at is a text ISO-8601 UTC string (client writes new Date().toISOString()),
  // so a lexicographic > comparison against the cutoff ISO string is chronological.
  const cutoff = new Date(Date.now() - SHARE_WINDOW_MS).toISOString();
  const res = await pool.query<{ round_id: string; first_name: string | null; last_name: string | null }>(
    `SELECT r.id AS round_id, u.first_name, u.last_name
       FROM rounds r
       JOIN users u ON u.id = r.user_id
       LEFT JOIN round_share_notifications n
         ON n.round_owner_id = r.user_id AND n.round_id = r.id
      WHERE r.user_id = $1
        AND r.deleted_at IS NULL
        AND r.completed_at IS NOT NULL
        AND r.completed_at > $2
        AND COALESCE(r.exclude_from_sharing, 0) = 0
        AND n.round_id IS NULL`,
    [ownerId, cutoff],
  );
  return res.rows.map((row) => ({
    roundId: row.round_id,
    ownerName: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || 'A friend',
  }));
}

// Claim a round in the idempotency ledger. Returns true only if THIS call
// inserted the row — concurrent pushes for the same round race here and exactly
// one wins, guaranteeing the notification is sent at most once.
async function claimRound(ownerId: string, roundId: string): Promise<boolean> {
  const res = await pool.query(
    `INSERT INTO round_share_notifications (round_owner_id, round_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [ownerId, roundId],
  );
  return (res.rowCount ?? 0) > 0;
}

// Release a claim when the attempt did not actually deliver (no recipients, or a
// transient send failure), so the next completion PUT for this round can retry.
async function releaseClaim(ownerId: string, roundId: string): Promise<void> {
  await pool.query(
    `DELETE FROM round_share_notifications WHERE round_owner_id = $1 AND round_id = $2`,
    [ownerId, roundId],
  );
}

// All Expo push tokens belonging to the owner's friends, excluding any friend
// blocked in either direction. Friendships are stored once with user_low <
// user_high (same convention as community/routes.ts), and the block-exclusion
// mirrors the NOT EXISTS fragment in community/routes.ts.
async function friendTokens(ownerId: string): Promise<string[]> {
  const res = await pool.query<{ token: string }>(
    `WITH friends AS (
       SELECT CASE WHEN user_low = $1 THEN user_high ELSE user_low END AS fid
       FROM friendships WHERE user_low = $1 OR user_high = $1
     )
     SELECT t.token FROM push_tokens t
     JOIN friends f ON f.fid = t.user_id
     WHERE NOT EXISTS (
       SELECT 1 FROM user_blocks ub
       WHERE (ub.blocker_id = $1 AND ub.blocked_id = f.fid)
          OR (ub.blocker_id = f.fid AND ub.blocked_id = $1)
     )`,
    [ownerId],
  );
  return res.rows.map((r) => r.token).filter((t) => Expo.isExpoPushToken(t));
}

// Send the chunked messages and prune any tokens Expo reports as unregistered.
// Returns false if any chunk failed to send, so the caller can release the claim
// and let the next completion PUT retry instead of losing the notification.
async function sendAndPrune(messages: ExpoPushMessage[]): Promise<boolean> {
  const dead: string[] = [];
  let ok = true;
  // Map each chunk's tickets back to that chunk's messages. Keeping the
  // index alignment chunk-local means a single failed chunk can't desync the
  // ticket→token mapping for the others.
  for (const chunk of expo.chunkPushNotifications(messages)) {
    let tickets: ExpoPushTicket[];
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('[notifications] expo send failed', err);
      ok = false;
      continue;
    }
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const to = chunk[i]?.to;
        if (typeof to === 'string') dead.push(to);
      }
    });
  }
  if (dead.length > 0) {
    await pool.query(`DELETE FROM push_tokens WHERE token = ANY($1)`, [dead]);
  }
  return ok;
}

// Notify the owner's friends that they finished + shared a round. Idempotent and
// safe to call after every /sync/push (the ledger short-circuits repeats). Never
// throws — callers fire-and-forget it so sync latency is unaffected.
export async function dispatchRoundShareNotifications(ownerId: string): Promise<void> {
  try {
    const pending = await findUnnotifiedRounds(ownerId);
    if (pending.length === 0) return;

    const tokens = await friendTokens(ownerId);

    for (const round of pending) {
      // Claim first so concurrent dispatches for the same round can't double-send
      // (the INSERT is the at-most-once gate). But only KEEP the claim if we
      // actually deliver — otherwise release it so a later attempt (once a friend
      // registers a token, or after a transient Expo failure) can still fire,
      // bounded by the recency window in findUnnotifiedRounds.
      if (!(await claimRound(ownerId, round.roundId))) continue;
      if (tokens.length === 0) {
        await releaseClaim(ownerId, round.roundId);
        continue;
      }

      const messages: ExpoPushMessage[] = tokens.map((to) => ({
        to,
        title: 'CaddieBook',
        body: `${round.ownerName} just finished a round. Check out their recent round.`,
        sound: 'default',
        data: { url: COMMUNITY_TAB_URL },
      }));
      if (!(await sendAndPrune(messages))) {
        await releaseClaim(ownerId, round.roundId);
      }
    }
  } catch (err) {
    console.error('[notifications] dispatch failed', err);
  }
}

// Exposed for the token-registration route's validation.
export const isExpoPushToken = (t: string): boolean => Expo.isExpoPushToken(t);
