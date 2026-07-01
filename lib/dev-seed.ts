import { authedRequest, pushChanges } from '@/lib/api/client';
import { queryClient } from '@/lib/data/query-client';
import type { DataRoundsResponse } from '@/lib/data/types';
import type { WireChange, WireRow } from '@/lib/api/types';
import {
  buildHole,
  chance,
  clamp,
  COURSES,
  FRONT_NINE,
  gauss,
  PARS_18,
  pick,
  randInt,
  COMMON_MISS,
  MOST_COSTLY,
  RANGE_FOCUS,
} from '@/lib/sample-rounds';
import { uuid } from '@/lib/uuid';

// Dev-only sample-data generator for testing the Stats tab on a simulator.
// Seeds realistic, completed rounds whose skill improves over time so the
// over-time trends actually have a story to tell. Never shipped (gated by
// __DEV__ at the call site). The golfer simulation itself lives in
// lib/sample-rounds.ts (shared with the onboarding tour's mock progress story);
// this module only maps those seeds to wire rows and pushes them.
//
// Writes go straight to the server: the ~5k generated rows batch through the
// legacy /sync/push (one request) rather than the per-command outbox, then
// every query refetches. (When /sync/push is removed, this tool needs a bulk
// /data path.)

// The dev seeder wants genuine variety run-to-run, so it draws from Math.random.
const rng = Math.random;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function seedSampleRounds(count = 70): Promise<void> {
  const changes: WireChange[] = [];
  const now = new Date().toISOString();
  const stamp = (row: WireRow): WireRow => ({ ...row, updated_at: now, deleted_at: null });

  // Seed the saved courses + tees so the New Round picker is populated.
  for (const c of COURSES) {
    const courseId = uuid();
    changes.push({ table: 'courses', row: stamp({ id: courseId, name: c.name, created_at: now }) });
    changes.push({
      table: 'tees',
      row: stamp({
        id: uuid(),
        course_id: courseId,
        name: c.tee,
        course_rating: c.rating,
        slope_rating: c.slope,
        par: 72,
        created_at: now,
      }),
    });
  }

  // Dates ascending, ending today; ~weekly cadence.
  const today = new Date();
  let cursor = new Date(today.getTime() - count * 7 * 86400000 - 7 * 86400000);

  for (let i = 0; i < count; i++) {
    cursor = new Date(cursor.getTime() + randInt(rng, 3, 11) * 86400000);
    if (cursor > today) cursor = today;
    const date = isoDate(cursor);

    // Skill 0→1 over the season, plus a per-round form swing.
    const baseSkill = 0.15 + 0.7 * (i / Math.max(1, count - 1));
    const skill = clamp(baseSkill + gauss(rng, 0, 0.12), 0, 1);

    const holeCount = chance(rng, 0.78) ? 18 : 9;
    const pars = holeCount === 18 ? PARS_18 : FRONT_NINE;

    const roundId = uuid();
    const course = pick(rng, COURSES);
    // 9-hole rounds snapshot roughly half the 18-hole rating.
    const rating = holeCount === 18 ? course.rating : Math.round((course.rating / 2) * 10) / 10;
    // Seeded rounds are flagged exclude_from_sharing = 1 so completing them
    // doesn't fan out a "friend finished a round" push per round to every
    // friend — see dispatchRoundShareNotifications.
    changes.push({
      table: 'rounds',
      row: stamp({
        id: roundId,
        course_name: course.name,
        date_played: date,
        hole_count: holeCount,
        completed_at: `${date}T20:30:00.000Z`,
        created_at: `${date} 12:00:00`,
        tee_name: course.tee,
        course_rating: rating,
        slope_rating: course.slope,
        exclude_from_sharing: 1,
      }),
    });

    for (let h = 0; h < pars.length; h++) {
      const hole = buildHole(rng, h + 1, pars[h], skill);
      changes.push({
        table: 'holes',
        row: stamp({
          id: uuid(),
          round_id: roundId,
          hole_number: hole.holeNumber,
          par: hole.par,
          fir: hole.fir,
          // Persist the on-green call buildHole derived so seeded rounds mirror what
          // the live app records (its approach-page pre-fill writes gir); otherwise
          // gir stays null and every consumer has to fall back to derivation.
          gir: hole.gir ? 1 : 0,
          approach_distance_yds: hole.approachDistance,
          drive_distance_yds: hole.driveDistance,
          approach_club: hole.approachClub,
          drive_club: hole.driveClub,
          score: hole.score,
          putts: hole.putts,
          chip_shots: hole.chipShots,
          sand_shots: hole.sandShots,
          penalties: hole.penalties,
        }),
      });

      if (hole.drive) {
        changes.push({
          table: 'shots',
          row: stamp({
            id: uuid(),
            round_id: roundId,
            hole_number: hole.holeNumber,
            shot_type: 'driver',
            x_norm: hole.drive.x,
            y_norm: hole.drive.y,
          }),
        });
      }
      changes.push({
        table: 'shots',
        row: stamp({
          id: uuid(),
          round_id: roundId,
          hole_number: hole.holeNumber,
          shot_type: 'approach',
          x_norm: hole.approach.x,
          y_norm: hole.approach.y,
        }),
      });

      for (const p of hole.puttRows) {
        changes.push({
          table: 'putts',
          row: stamp({
            id: uuid(),
            round_id: roundId,
            hole_number: hole.holeNumber,
            distance_ft: p.distanceFt,
            made: p.made,
            created_at: `${date} 13:00:00`,
          }),
        });
      }
    }

    // Post-round review — ratings improve with skill.
    changes.push({
      table: 'post_round_reviews',
      row: stamp({
        id: uuid(),
        round_id: roundId,
        most_costly: pick(rng, MOST_COSTLY),
        decision_making_rating: Math.round(clamp(4 + 5 * skill + gauss(rng, 0, 1), 1, 10)),
        common_miss: pick(rng, COMMON_MISS),
        range_focus: pick(rng, RANGE_FOCUS),
        overall_rating: Math.round(clamp(3 + 6 * skill + gauss(rng, 0, 1), 1, 10)),
        created_at: `${date} 20:45:00`,
      }),
    });
  }

  await pushChanges(changes);
  await queryClient.invalidateQueries();
}

export async function clearAllRounds(): Promise<void> {
  // Dev reset: hard-delete every round (children cascade server-side).
  const { rounds } = await authedRequest<DataRoundsResponse>('/data/rounds', 'GET');
  for (const round of rounds) {
    await authedRequest(`/data/rounds/${round.id}`, 'DELETE');
  }
  await queryClient.invalidateQueries();
}
