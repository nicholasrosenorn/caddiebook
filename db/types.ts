export type Round = {
  id: string;
  courseName: string;
  datePlayed: string;
  holeCount: number;
  completedAt: string | null;
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
  score: number | null;
  putts: number | null;
  chipShots: number | null;
  sandShots: number | null;
  penalties: number | null;
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
  | 'short_game';

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

export type RoundSummary = {
  holesPlayed: number;
  totalScore: number;
  totalPutts: number;
  firPct: number | null;
  girPct: number | null;
  udPct: number | null;
};
