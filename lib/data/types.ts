import type {
  CommonMiss,
  Course,
  Hole,
  JournalEntry,
  JournalTag,
  MostCostly,
  PostRoundReview,
  PreRoundGoals,
  Putt,
  RangeFocus,
  Round,
  Shot,
  ShotType,
  Tee,
} from '@/lib/data/models';

// Client mirror of the server's /data wire contract (server/src/wire.ts). Rows
// travel snake_case; booleans travel as 0/1 integers. The mappers below convert
// to the camelCase domain types the UI has always consumed.

export type WireValue = string | number | boolean | null;
export type WireRow = Record<string, WireValue>;

export type WireRound = {
  id: string;
  course_name: string | null;
  date_played: string | null;
  hole_count: number | null;
  completed_at: string | null;
  tee_name: string | null;
  course_rating: number | null;
  slope_rating: number | null;
  include_in_handicap: number | null;
  exclude_from_sharing: number | null;
  created_at: string | null;
};

export type WireHole = {
  id: string;
  round_id: string;
  hole_number: number;
  par: number | null;
  fir: number | null;
  gir: number | null;
  up_and_down: number | null;
  approach_distance_yds: number | null;
  approach_club: string | null;
  drive_club: string | null;
  score: number | null;
  putts: number | null;
  chip_shots: number | null;
  sand_shots: number | null;
  penalties: number | null;
  green_blocked: number | null;
  notes: string | null;
};

export type WireShot = {
  id: string;
  round_id: string;
  hole_number: number;
  shot_type: string;
  x_norm: number;
  y_norm: number;
  intended_x_norm: number | null;
  intended_y_norm: number | null;
  notes: string | null;
};

export type WirePutt = {
  id: string;
  round_id: string;
  hole_number: number;
  distance_ft: number;
  made: number;
  created_at: string | null;
};

export type WireReview = {
  id: string;
  round_id: string;
  most_costly: string | null;
  decision_making_rating: number | null;
  common_miss: string | null;
  range_focus: string | null;
  overall_rating: number | null;
  created_at: string | null;
};

export type WireGoals = {
  id: string;
  round_id: string;
  execution_goal: string | null;
  strategic_goal: string | null;
  mental_goal: string | null;
  created_at: string | null;
};

export type WireCourse = { id: string; name: string | null; created_at: string | null };

export type WireTee = {
  id: string;
  course_id: string | null;
  name: string | null;
  course_rating: number | null;
  slope_rating: number | null;
  par: number | null;
  created_at: string | null;
};

export type WireJournalEntry = {
  id: string;
  tag: string | null;
  body: string | null;
  created_at: string | null;
  updated_at: string | null;
};

// --- Responses ---------------------------------------------------------------

export type DataRoundsResponse = { rounds: (WireRound & { holes: WireHole[] })[] };

export type RoundFullResponse = {
  round: WireRound;
  holes: WireHole[];
  shots: WireShot[];
  putts: WirePutt[];
  review: WireReview | null;
  goals: WireGoals | null;
};

export type StatsBundleResponse = {
  rounds: WireRound[];
  holes: WireHole[];
  shots: WireShot[];
  putts: WirePutt[];
  reviews: WireReview[];
};

export type CoursesResponse = { courses: (WireCourse & { tees: WireTee[] })[] };
export type JournalResponse = { entries: WireJournalEntry[] };
export type SettingsResponse = { settings: Record<string, string> };

// --- Wire → domain mappers (semantics match the old db/queries rowTo*) -------

function toBool(v: number | null): boolean | null {
  return v == null ? null : v === 1;
}

export function wireToRound(row: WireRound): Round {
  return {
    id: row.id,
    courseName: row.course_name ?? '',
    datePlayed: row.date_played ?? '',
    holeCount: row.hole_count ?? 18,
    completedAt: row.completed_at,
    teeName: row.tee_name,
    courseRating: row.course_rating,
    slopeRating: row.slope_rating,
    includeInHandicap: row.include_in_handicap === 1,
    excludeFromSharing: row.exclude_from_sharing === 1,
    createdAt: row.created_at ?? '',
  };
}

export function wireToHole(row: WireHole): Hole {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    par: row.par,
    fir: toBool(row.fir),
    gir: toBool(row.gir),
    upAndDown: toBool(row.up_and_down),
    approachDistanceYds: row.approach_distance_yds,
    approachClub: row.approach_club,
    driveClub: row.drive_club,
    score: row.score,
    putts: row.putts,
    chipShots: row.chip_shots,
    sandShots: row.sand_shots,
    penalties: row.penalties,
    greenBlocked: toBool(row.green_blocked),
    notes: row.notes,
  };
}

export function wireToShot(row: WireShot): Shot {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    shotType: row.shot_type as ShotType,
    xNorm: row.x_norm,
    yNorm: row.y_norm,
    intendedXNorm: row.intended_x_norm,
    intendedYNorm: row.intended_y_norm,
    notes: row.notes,
  };
}

export function wireToPutt(row: WirePutt): Putt {
  return {
    id: row.id,
    roundId: row.round_id,
    holeNumber: row.hole_number,
    distanceFt: row.distance_ft,
    made: row.made === 1,
    createdAt: row.created_at ?? '',
  };
}

export function wireToReview(row: WireReview): PostRoundReview {
  return {
    id: row.id,
    roundId: row.round_id,
    mostCostly: (row.most_costly as MostCostly | null) ?? null,
    decisionMakingRating: row.decision_making_rating,
    commonMiss:
      row.common_miss != null && row.common_miss.length > 0
        ? ((row.common_miss.split(',')[0] || null) as CommonMiss | null)
        : null,
    rangeFocus: (row.range_focus as RangeFocus | null) ?? null,
    overallRating: row.overall_rating,
    createdAt: row.created_at ?? '',
  };
}

export function wireToGoals(row: WireGoals): PreRoundGoals {
  return {
    id: row.id,
    roundId: row.round_id,
    execution: row.execution_goal,
    strategic: row.strategic_goal,
    mental: row.mental_goal,
    createdAt: row.created_at ?? '',
  };
}

export function wireToCourse(row: WireCourse): Course {
  return { id: row.id, name: row.name ?? '', createdAt: row.created_at ?? '' };
}

export function wireToTee(row: WireTee): Tee {
  return {
    id: row.id,
    courseId: row.course_id ?? '',
    name: row.name ?? '',
    courseRating: row.course_rating ?? 0,
    slopeRating: row.slope_rating ?? 0,
    par: row.par,
    createdAt: row.created_at ?? '',
  };
}

export function wireToJournalEntry(row: WireJournalEntry): JournalEntry {
  return {
    id: row.id,
    tag: (row.tag as JournalTag) ?? 'swing_thought',
    body: row.body,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}
