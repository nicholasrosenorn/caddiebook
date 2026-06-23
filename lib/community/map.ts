// Convert the snake_case wire rows from the /community API into the local
// camelCase models, so feed/detail screens can reuse the same components and
// stat helpers (computeRoundSummary, etc.) the user's own rounds use.

import type { Hole, PostRoundReview, PreRoundGoals, Putt, Shot, ShotType } from '@/lib/data/models';
import type {
  WireGoals,
  WireHole,
  WirePutt,
  WireReview,
  WireShot,
} from '@/lib/api/types';

const toBool = (v: number | null): boolean | null => (v == null ? null : v === 1);

export function wireHoleToHole(w: WireHole): Hole {
  return {
    id: w.id,
    roundId: w.round_id,
    holeNumber: w.hole_number,
    par: w.par,
    fir: toBool(w.fir),
    gir: toBool(w.gir),
    upAndDown: toBool(w.up_and_down),
    approachDistanceYds: w.approach_distance_yds,
    approachClub: w.approach_club,
    driveClub: w.drive_club,
    driveDistanceYds: w.drive_distance_yds,
    score: w.score,
    putts: w.putts,
    chipShots: w.chip_shots,
    sandShots: w.sand_shots,
    penalties: w.penalties,
    greenBlocked: toBool(w.green_blocked),
    notes: w.notes,
  };
}

export function wireShotToShot(w: WireShot): Shot {
  return {
    id: w.id,
    roundId: w.round_id,
    holeNumber: w.hole_number,
    shotType: w.shot_type as ShotType,
    xNorm: w.x_norm,
    yNorm: w.y_norm,
    intendedXNorm: w.intended_x_norm,
    intendedYNorm: w.intended_y_norm,
    notes: w.notes,
  };
}

export function wirePuttToPutt(w: WirePutt): Putt {
  return {
    id: w.id,
    roundId: w.round_id,
    holeNumber: w.hole_number,
    distanceFt: w.distance_ft,
    made: w.made === 1,
    createdAt: w.created_at ?? '',
  };
}

export function wireReviewToReview(w: WireReview): PostRoundReview {
  return {
    id: w.id,
    roundId: w.round_id,
    mostCostly: w.most_costly as PostRoundReview['mostCostly'],
    decisionMakingRating: w.decision_making_rating,
    commonMiss: w.common_miss as PostRoundReview['commonMiss'],
    rangeFocus: w.range_focus as PostRoundReview['rangeFocus'],
    overallRating: w.overall_rating,
    createdAt: '',
  };
}

export function wireGoalsToGoals(w: WireGoals): PreRoundGoals {
  return {
    id: w.id,
    roundId: w.round_id,
    execution: w.execution_goal,
    strategic: w.strategic_goal,
    mental: w.mental_goal,
    createdAt: '',
  };
}
