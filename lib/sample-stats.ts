import type { Hole, PostRoundReview, Putt, Round, Shot } from '@/lib/data/models';
import type { StatsBundle } from '@/lib/data/stats';
import {
  buildHole,
  clamp,
  COURSES,
  gauss,
  mulberry32,
  PARS_18,
  pick,
  COMMON_MISS,
  MOST_COSTLY,
  RANGE_FOCUS,
} from '@/lib/sample-rounds';

// A deterministic, in-memory "example golfer's season" for the onboarding tour's
// progress payoff page. It runs the same simulation as the dev seeder
// (lib/sample-rounds.ts) but with a FIXED seed, so the story is identical every
// time and never renders a bad random run — and it produces domain models, not
// wire rows, so it feeds the pure stats aggregates directly.
//
// Crucially this never touches the server, the outbox, or the query cache: it's
// purely illustrative ("here's what an improving mid-handicap season looks like —
// your numbers fill in as you play"), and the user's real data is untouched.

const SEED = 0xcadd1e;
const ROUND_COUNT = 25;

export type SampleSeason = {
  /** Flat-array corpus, shaped exactly like the live stats query — feeds the real
   *  ProgressView (ProgressViewBase) so the tour's first page is the Stats tab. */
  bundle: StatsBundle;
  holesByRound: Map<string, Hole[]>;
  shotsByRound: Map<string, Shot[]>;
  puttsByRound: Map<string, Putt[]>;
  reviewsByRound: Map<string, PostRoundReview>;
};

// 25 completed 18-hole rounds for a mid-handicapper improving across a season:
// skill ramps 0.30 → 0.75 (plus a small seeded form swing), which the WHS-lite
// math reads out as a Handicap Index trending down from the low-teens toward the
// high single digits — the "~10 and improving" story.
export function buildSampleSeason(): SampleSeason {
  const rng = mulberry32(SEED);

  const rounds: Round[] = [];
  const allHoles: Hole[] = [];
  const allShots: Shot[] = [];
  const allPutts: Putt[] = [];
  const reviews: PostRoundReview[] = [];
  const holesByRound = new Map<string, Hole[]>();
  const shotsByRound = new Map<string, Shot[]>();
  const puttsByRound = new Map<string, Putt[]>();
  const reviewsByRound = new Map<string, PostRoundReview>();

  // Dates ascending, ending ~today; weekly cadence.
  const today = new Date();
  const start = today.getTime() - ROUND_COUNT * 7 * 86400000;

  for (let i = 0; i < ROUND_COUNT; i++) {
    const day = new Date(start + i * 7 * 86400000);
    const date = day.toISOString().slice(0, 10);
    const stamp = `${date}T20:30:00.000Z`;

    const skill = clamp(0.3 + 0.45 * (i / (ROUND_COUNT - 1)) + gauss(rng, 0, 0.08), 0, 1);

    const roundId = `sample-r${i}`;
    const course = pick(rng, COURSES);

    rounds.push({
      id: roundId,
      courseName: course.name,
      datePlayed: date,
      holeCount: 18,
      completedAt: stamp,
      teeName: course.tee,
      courseRating: course.rating,
      slopeRating: course.slope,
      includeInHandicap: true,
      excludeFromSharing: true,
      createdAt: stamp,
    });

    const holes: Hole[] = [];
    const shots: Shot[] = [];
    const putts: Putt[] = [];

    for (let h = 0; h < PARS_18.length; h++) {
      const seed = buildHole(rng, h + 1, PARS_18[h], skill);
      holes.push({
        id: `${roundId}-h${seed.holeNumber}`,
        roundId,
        holeNumber: seed.holeNumber,
        par: seed.par,
        // Leave gir / upAndDown null so the same derivation the app uses
        // (resolveGir / resolveUpAndDown) drives the stats.
        fir: seed.fir == null ? null : seed.fir === 1,
        gir: null,
        upAndDown: null,
        approachDistanceYds: seed.approachDistance,
        approachClub: seed.approachClub,
        driveClub: seed.driveClub,
        driveDistanceYds: seed.driveDistance,
        score: seed.score,
        putts: seed.putts,
        chipShots: seed.chipShots,
        sandShots: seed.sandShots,
        penalties: seed.penalties,
        greenBlocked: null,
        notes: null,
      });

      if (seed.drive) {
        shots.push({
          id: `${roundId}-h${seed.holeNumber}-drive`,
          roundId,
          holeNumber: seed.holeNumber,
          shotType: 'driver',
          xNorm: seed.drive.x,
          yNorm: seed.drive.y,
          intendedXNorm: null,
          intendedYNorm: null,
          notes: null,
        });
      }
      shots.push({
        id: `${roundId}-h${seed.holeNumber}-appr`,
        roundId,
        holeNumber: seed.holeNumber,
        shotType: 'approach',
        xNorm: seed.approach.x,
        yNorm: seed.approach.y,
        intendedXNorm: null,
        intendedYNorm: null,
        notes: null,
      });

      seed.puttRows.forEach((p, pi) => {
        putts.push({
          id: `${roundId}-h${seed.holeNumber}-p${pi}`,
          roundId,
          holeNumber: seed.holeNumber,
          distanceFt: p.distanceFt,
          made: p.made === 1,
          createdAt: stamp,
        });
      });
    }

    holesByRound.set(roundId, holes);
    shotsByRound.set(roundId, shots);
    puttsByRound.set(roundId, putts);
    allHoles.push(...holes);
    allShots.push(...shots);
    allPutts.push(...putts);

    const review: PostRoundReview = {
      id: `${roundId}-review`,
      roundId,
      mostCostly: pick(rng, MOST_COSTLY) as PostRoundReview['mostCostly'],
      decisionMakingRating: Math.round(clamp(4 + 5 * skill + gauss(rng, 0, 1), 1, 10)),
      commonMiss: pick(rng, COMMON_MISS) as PostRoundReview['commonMiss'],
      rangeFocus: pick(rng, RANGE_FOCUS) as PostRoundReview['rangeFocus'],
      overallRating: Math.round(clamp(3 + 6 * skill + gauss(rng, 0, 1), 1, 10)),
      createdAt: stamp,
    };
    reviews.push(review);
    reviewsByRound.set(roundId, review);
  }

  return {
    bundle: { rounds, holes: allHoles, shots: allShots, putts: allPutts, reviews },
    holesByRound,
    shotsByRound,
    puttsByRound,
    reviewsByRound,
  };
}
