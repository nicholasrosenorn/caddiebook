export type Round = {
  id: string;
  courseName: string;
  datePlayed: string;
  holeCount: number;
  completedAt: string | null;
  /** Tee set played, snapshot from the course's tee at round creation. */
  teeName: string | null;
  /** Course/Slope Rating used for handicap, snapshot so later tee edits don't
   *  rewrite history. Null = unrated → handicap math defaults to par / 113. */
  courseRating: number | null;
  slopeRating: number | null;
  /** Whether this round posts a differential to the Handicap Index. */
  includeInHandicap: boolean;
  /** When true, the round is hidden from friends' Community feed. */
  excludeFromSharing: boolean;
  createdAt: string;
};

export type Course = {
  id: string;
  name: string;
  createdAt: string;
};

export type Tee = {
  id: string;
  courseId: string;
  name: string;
  courseRating: number;
  slopeRating: number;
  par: number | null;
  createdAt: string;
};

export type Hole = {
  id: string;
  roundId: string;
  holeNumber: number;
  par: number | null;
  fir: boolean | null;
  gir: boolean | null;
  upAndDown: boolean | null;
  approachDistanceYds: number | null;
  approachClub: string | null;
  driveClub: string | null;
  score: number | null;
  putts: number | null;
  chipShots: number | null;
  sandShots: number | null;
  penalties: number | null;
  greenBlocked: boolean | null;
  notes: string | null;
};

export type ShotType = 'driver' | 'approach';

export type Shot = {
  id: string;
  roundId: string;
  holeNumber: number;
  shotType: ShotType;
  xNorm: number;
  yNorm: number;
  intendedXNorm: number | null;
  intendedYNorm: number | null;
  notes: string | null;
};

export type Putt = {
  id: string;
  roundId: string;
  holeNumber: number;
  distanceFt: number;
  made: boolean;
  createdAt: string;
};

export type MostCostly =
  | 'putting'
  | 'driving'
  | 'wedge_play'
  | 'mid_irons'
  | 'long_irons';

export type CommonMiss = 'left' | 'right' | 'long' | 'short' | 'mixed';

export type RangeFocus =
  | 'tempo'
  | 'technique'
  | 'approach_game'
  | 'chipping'
  | 'putting'
  | 'pre_shot_routine'
  | 'short_game'
  | 'driving'
  ;

export type PostRoundReview = {
  id: string;
  roundId: string;
  mostCostly: MostCostly | null;
  decisionMakingRating: number | null;
  commonMiss: CommonMiss | null;
  rangeFocus: RangeFocus | null;
  overallRating: number | null;
  createdAt: string;
};

export type PreRoundGoals = {
  id: string;
  roundId: string;
  execution: string | null;
  strategic: string | null;
  mental: string | null;
  createdAt: string;
};

export type JournalTag = 'swing_thought' | 'practice_session' | 'round_summary';

export type JournalEntry = {
  id: string;
  tag: JournalTag;
  body: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RoundSummary = {
  holesPlayed: number;
  totalScore: number;
  totalPutts: number;
  firPct: number | null;
  girPct: number | null;
  udPct: number | null;
};
