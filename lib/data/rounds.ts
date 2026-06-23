import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import type {
  Hole,
  PostRoundReview,
  PreRoundGoals,
  Putt,
  Round,
  Shot,
  ShotType,
} from '@/lib/data/models';
import { useUserId } from '@/lib/auth/provider';
import { uuid } from '@/lib/uuid';

import { fetchRoundFull, fetchRounds } from './api';
import { keys } from './keys';
import { enqueue } from './outbox';
import { queryClient } from './query-client';
import {
  wireToGoals,
  wireToHole,
  wireToPutt,
  wireToReview,
  wireToRound,
  wireToShot,
  type WireRow,
} from './types';

// Round data hooks. Reads are react-query over /data (cached + persisted);
// writes apply optimistically to the cache and enqueue an idempotent command in
// the outbox — the UI never waits on the network, and a dead zone never loses a
// tap. Cache values are the same domain types the UI always consumed.

export type RoundDetail = {
  round: Round;
  holes: Hole[];
  shots: Shot[];
  putts: Putt[];
  review: PostRoundReview | null;
  goals: PreRoundGoals | null;
};

export type RoundListItem = Round & { holes: Hole[] };

// --- Reads -------------------------------------------------------------------

export function useRounds() {
  const uid = useUserId();
  return useQuery({
    queryKey: keys.rounds(uid),
    enabled: uid !== '',
    queryFn: async (): Promise<RoundListItem[]> => {
      const res = await fetchRounds();
      return res.rounds.map((r) => ({ ...wireToRound(r), holes: r.holes.map(wireToHole) }));
    },
  });
}

export function useRoundFull(roundId: string | undefined) {
  const uid = useUserId();
  return useQuery({
    queryKey: keys.roundFull(uid, roundId ?? ''),
    enabled: uid !== '' && !!roundId,
    queryFn: async (): Promise<RoundDetail> => {
      const res = await fetchRoundFull(roundId!);
      return {
        round: wireToRound(res.round),
        holes: res.holes.map(wireToHole),
        shots: res.shots.map(wireToShot),
        putts: res.putts.map(wireToPutt),
        review: res.review ? wireToReview(res.review) : null,
        goals: res.goals ? wireToGoals(res.goals) : null,
      };
    },
  });
}

// --- Cache surgery helpers -----------------------------------------------------

function patchRoundDetail(uid: string, roundId: string, fn: (detail: RoundDetail) => RoundDetail) {
  queryClient.setQueryData<RoundDetail>(keys.roundFull(uid, roundId), (prev) =>
    prev ? fn(prev) : prev,
  );
}

function patchRoundList(
  uid: string,
  fn: (rounds: RoundListItem[]) => RoundListItem[],
) {
  queryClient.setQueryData<RoundListItem[]>(keys.rounds(uid), (prev) => (prev ? fn(prev) : prev));
}

function patchHoleEverywhere(
  uid: string,
  roundId: string,
  holeNumber: number,
  patch: Partial<Hole>,
) {
  const apply = (h: Hole) => (h.holeNumber === holeNumber ? { ...h, ...patch } : h);
  patchRoundDetail(uid, roundId, (d) => ({ ...d, holes: d.holes.map(apply) }));
  patchRoundList(uid, (rounds) =>
    rounds.map((r) => (r.id === roundId ? { ...r, holes: r.holes.map(apply) } : r)),
  );
}

// --- Domain → wire patch mappers ----------------------------------------------

const HOLE_FIELD_TO_COLUMN: Record<string, string> = {
  par: 'par',
  fir: 'fir',
  gir: 'gir',
  upAndDown: 'up_and_down',
  approachDistanceYds: 'approach_distance_yds',
  approachClub: 'approach_club',
  driveClub: 'drive_club',
  driveDistanceYds: 'drive_distance_yds',
  score: 'score',
  putts: 'putts',
  chipShots: 'chip_shots',
  sandShots: 'sand_shots',
  penalties: 'penalties',
  greenBlocked: 'green_blocked',
  notes: 'notes',
};

const BOOL_HOLE_FIELDS = new Set(['fir', 'gir', 'upAndDown', 'greenBlocked']);

export type HolePatch = Partial<Omit<Hole, 'id' | 'roundId' | 'holeNumber'>>;

function holePatchToWire(patch: HolePatch): WireRow {
  const wire: WireRow = {};
  for (const [field, value] of Object.entries(patch)) {
    const column = HOLE_FIELD_TO_COLUMN[field];
    if (!column) continue;
    if (value == null) wire[column] = null;
    else if (BOOL_HOLE_FIELDS.has(field)) wire[column] = value ? 1 : 0;
    else wire[column] = value as WireRow[string];
  }
  return wire;
}

export type RoundPatch = Partial<
  Pick<
    Round,
    'completedAt' | 'includeInHandicap' | 'excludeFromSharing' | 'courseRating' | 'slopeRating'
  >
>;

function roundPatchToWire(patch: RoundPatch): WireRow {
  const wire: WireRow = {};
  if ('completedAt' in patch) wire.completed_at = patch.completedAt ?? null;
  if ('includeInHandicap' in patch) wire.include_in_handicap = patch.includeInHandicap ? 1 : 0;
  if ('excludeFromSharing' in patch) wire.exclude_from_sharing = patch.excludeFromSharing ? 1 : 0;
  if ('courseRating' in patch) wire.course_rating = patch.courseRating ?? null;
  if ('slopeRating' in patch) wire.slope_rating = patch.slopeRating ?? null;
  return wire;
}

// --- Mutations -----------------------------------------------------------------

export type CreateRoundInput = {
  courseName: string;
  datePlayed: string;
  holeCount: number;
  teeName?: string | null;
  courseRating?: number | null;
  slopeRating?: number | null;
  includeInHandicap?: boolean;
  excludeFromSharing?: boolean;
};

export function useCreateRound() {
  const uid = useUserId();
  return useCallback(
    async (input: CreateRoundInput): Promise<string> => {
      const roundId = uuid();
      const createdAt = new Date().toISOString();
      const round: Round = {
        id: roundId,
        courseName: input.courseName,
        datePlayed: input.datePlayed,
        holeCount: input.holeCount,
        completedAt: null,
        teeName: input.teeName ?? null,
        courseRating: input.courseRating ?? null,
        slopeRating: input.slopeRating ?? null,
        includeInHandicap: input.includeInHandicap ?? true,
        excludeFromSharing: input.excludeFromSharing ?? false,
        createdAt,
      };
      const holes: Hole[] = Array.from({ length: input.holeCount }, (_, i) => ({
        id: uuid(),
        roundId,
        holeNumber: i + 1,
        par: null,
        fir: null,
        gir: null,
        upAndDown: null,
        approachDistanceYds: null,
        approachClub: null,
        driveClub: null,
        driveDistanceYds: null,
        score: null,
        putts: null,
        chipShots: null,
        sandShots: null,
        penalties: null,
        greenBlocked: null,
        notes: null,
      }));

      // Seed the caches so the round screen renders instantly (and offline).
      queryClient.setQueryData<RoundDetail>(keys.roundFull(uid, roundId), {
        round,
        holes,
        shots: [],
        putts: [],
        review: null,
        goals: null,
      });
      patchRoundList(uid, (rounds) => [{ ...round, holes }, ...rounds]);

      await enqueue({
        method: 'PUT',
        path: `/data/rounds/${roundId}`,
        body: {
          course_name: round.courseName,
          date_played: round.datePlayed,
          hole_count: round.holeCount,
          tee_name: round.teeName,
          course_rating: round.courseRating,
          slope_rating: round.slopeRating,
          include_in_handicap: round.includeInHandicap ? 1 : 0,
          exclude_from_sharing: round.excludeFromSharing ? 1 : 0,
          created_at: createdAt,
          holes: holes.map((h) => ({ id: h.id, round_id: roundId, hole_number: h.holeNumber })),
        },
        touches: [keys.rounds(uid), keys.roundFull(uid, roundId), keys.stats(uid)],
      });
      return roundId;
    },
    [uid],
  );
}

export function useUpdateRound() {
  const uid = useUserId();
  return useCallback(
    async (roundId: string, patch: RoundPatch): Promise<void> => {
      patchRoundDetail(uid, roundId, (d) => ({ ...d, round: { ...d.round, ...patch } }));
      patchRoundList(uid, (rounds) =>
        rounds.map((r) => (r.id === roundId ? { ...r, ...patch } : r)),
      );
      await enqueue({
        method: 'PUT',
        path: `/data/rounds/${roundId}`,
        body: roundPatchToWire(patch),
        touches: [keys.rounds(uid), keys.roundFull(uid, roundId), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export function useDeleteRound() {
  const uid = useUserId();
  return useCallback(
    async (roundId: string): Promise<void> => {
      patchRoundList(uid, (rounds) => rounds.filter((r) => r.id !== roundId));
      queryClient.removeQueries({ queryKey: keys.roundFull(uid, roundId) });
      await enqueue({
        method: 'DELETE',
        path: `/data/rounds/${roundId}`,
        touches: [keys.rounds(uid), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export function useUpdateHole() {
  const uid = useUserId();
  return useCallback(
    async (roundId: string, holeNumber: number, patch: HolePatch): Promise<void> => {
      const detail = queryClient.getQueryData<RoundDetail>(keys.roundFull(uid, roundId));
      const hole = detail?.holes.find((h) => h.holeNumber === holeNumber);
      patchHoleEverywhere(uid, roundId, holeNumber, patch);
      await enqueue({
        method: 'PUT',
        path: `/data/rounds/${roundId}/holes/${holeNumber}`,
        // The id is only used if the hole row is somehow missing server-side.
        body: { id: hole?.id ?? uuid(), ...holePatchToWire(patch) },
        touches: [keys.rounds(uid), keys.roundFull(uid, roundId), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export type UpsertShotInput = {
  roundId: string;
  holeNumber: number;
  shotType: ShotType;
  xNorm: number;
  yNorm: number;
  notes?: string | null;
  /** Hole fields derived from the shot (fir/gir/…), applied atomically. */
  holePatch?: HolePatch;
};

export function useUpsertShot() {
  const uid = useUserId();
  return useCallback(
    async (input: UpsertShotInput): Promise<void> => {
      const shot: Shot = {
        id: uuid(),
        roundId: input.roundId,
        holeNumber: input.holeNumber,
        shotType: input.shotType,
        xNorm: input.xNorm,
        yNorm: input.yNorm,
        intendedXNorm: null,
        intendedYNorm: null,
        notes: input.notes ?? null,
      };
      patchRoundDetail(uid, input.roundId, (d) => ({
        ...d,
        shots: [
          ...d.shots.filter(
            (s) => !(s.holeNumber === input.holeNumber && s.shotType === input.shotType),
          ),
          shot,
        ],
      }));
      if (input.holePatch) {
        patchHoleEverywhere(uid, input.roundId, input.holeNumber, input.holePatch);
      }
      await enqueue({
        method: 'PUT',
        path: `/data/rounds/${input.roundId}/holes/${input.holeNumber}/shots/${input.shotType}`,
        body: {
          id: shot.id,
          x_norm: shot.xNorm,
          y_norm: shot.yNorm,
          notes: shot.notes,
          ...(input.holePatch ? { hole: holePatchToWire(input.holePatch) } : {}),
        },
        touches: [keys.rounds(uid), keys.roundFull(uid, input.roundId), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export function useDeleteShot() {
  const uid = useUserId();
  return useCallback(
    async (
      roundId: string,
      holeNumber: number,
      shotType: ShotType,
      holePatch?: HolePatch,
    ): Promise<void> => {
      patchRoundDetail(uid, roundId, (d) => ({
        ...d,
        shots: d.shots.filter((s) => !(s.holeNumber === holeNumber && s.shotType === shotType)),
      }));
      if (holePatch) patchHoleEverywhere(uid, roundId, holeNumber, holePatch);
      await enqueue({
        method: 'DELETE',
        path: `/data/rounds/${roundId}/holes/${holeNumber}/shots/${shotType}`,
        body: holePatch ? { hole: holePatchToWire(holePatch) } : undefined,
        touches: [keys.rounds(uid), keys.roundFull(uid, roundId), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export type CreatePuttInput = {
  roundId: string;
  holeNumber: number;
  distanceFt: number;
  made: boolean;
};

// Recompute the hole's putt count from the (already updated) putt list —
// the same invariant the server maintains transactionally.
function recountPutts(uid: string, roundId: string, holeNumber: number, putts: Putt[]) {
  const count = putts.filter((p) => p.holeNumber === holeNumber).length;
  patchHoleEverywhere(uid, roundId, holeNumber, { putts: count });
}

export function useCreatePutt() {
  const uid = useUserId();
  return useCallback(
    async (input: CreatePuttInput): Promise<void> => {
      const putt: Putt = {
        id: uuid(),
        roundId: input.roundId,
        holeNumber: input.holeNumber,
        distanceFt: input.distanceFt,
        made: input.made,
        createdAt: new Date().toISOString(),
      };
      let nextPutts: Putt[] = [];
      patchRoundDetail(uid, input.roundId, (d) => {
        // A hole is only holed out once: a new made putt replaces any other
        // (mirrors the server's transaction).
        const kept = input.made
          ? d.putts.filter((p) => !(p.holeNumber === input.holeNumber && p.made))
          : d.putts;
        nextPutts = [...kept, putt];
        return { ...d, putts: nextPutts };
      });
      recountPutts(uid, input.roundId, input.holeNumber, nextPutts);
      await enqueue({
        method: 'PUT',
        path: `/data/putts/${putt.id}`,
        body: {
          round_id: putt.roundId,
          hole_number: putt.holeNumber,
          distance_ft: putt.distanceFt,
          made: putt.made ? 1 : 0,
          created_at: putt.createdAt,
        },
        touches: [keys.rounds(uid), keys.roundFull(uid, input.roundId), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export function useDeletePutt() {
  const uid = useUserId();
  return useCallback(
    async (roundId: string, puttId: string): Promise<void> => {
      const detail = queryClient.getQueryData<RoundDetail>(keys.roundFull(uid, roundId));
      const putt = detail?.putts.find((p) => p.id === puttId);
      if (!putt) return;
      let nextPutts: Putt[] = [];
      patchRoundDetail(uid, roundId, (d) => {
        nextPutts = d.putts.filter((p) => p.id !== puttId);
        return { ...d, putts: nextPutts };
      });
      recountPutts(uid, roundId, putt.holeNumber, nextPutts);
      await enqueue({
        method: 'DELETE',
        path: `/data/putts/${puttId}`,
        touches: [keys.rounds(uid), keys.roundFull(uid, roundId), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export type UpsertReviewInput = Omit<PostRoundReview, 'id' | 'roundId' | 'createdAt'>;

export function useUpsertReview() {
  const uid = useUserId();
  return useCallback(
    async (roundId: string, input: UpsertReviewInput): Promise<void> => {
      const detail = queryClient.getQueryData<RoundDetail>(keys.roundFull(uid, roundId));
      const review: PostRoundReview = {
        id: detail?.review?.id ?? uuid(),
        roundId,
        createdAt: detail?.review?.createdAt ?? new Date().toISOString(),
        ...input,
      };
      patchRoundDetail(uid, roundId, (d) => ({ ...d, review }));
      await enqueue({
        method: 'PUT',
        path: `/data/rounds/${roundId}/review`,
        body: {
          id: review.id,
          most_costly: review.mostCostly,
          decision_making_rating: review.decisionMakingRating,
          common_miss: review.commonMiss,
          range_focus: review.rangeFocus,
          overall_rating: review.overallRating,
          created_at: review.createdAt,
        },
        touches: [keys.roundFull(uid, roundId), keys.stats(uid)],
      });
    },
    [uid],
  );
}

export type UpsertGoalsInput = Omit<PreRoundGoals, 'id' | 'roundId' | 'createdAt'>;

export function useUpsertGoals() {
  const uid = useUserId();
  return useCallback(
    async (roundId: string, input: UpsertGoalsInput): Promise<void> => {
      const detail = queryClient.getQueryData<RoundDetail>(keys.roundFull(uid, roundId));
      const goals: PreRoundGoals = {
        id: detail?.goals?.id ?? uuid(),
        roundId,
        createdAt: detail?.goals?.createdAt ?? new Date().toISOString(),
        ...input,
      };
      patchRoundDetail(uid, roundId, (d) => ({ ...d, goals }));
      await enqueue({
        method: 'PUT',
        path: `/data/rounds/${roundId}/goals`,
        body: {
          id: goals.id,
          execution_goal: goals.execution,
          strategic_goal: goals.strategic,
          mental_goal: goals.mental,
          created_at: goals.createdAt,
        },
        touches: [keys.roundFull(uid, roundId)],
      });
    },
    [uid],
  );
}
