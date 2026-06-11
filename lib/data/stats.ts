import { useQuery } from '@tanstack/react-query';

import type { Hole, PostRoundReview, Putt, Round, Shot } from '@/lib/data/models';
import { useUserId } from '@/lib/auth/provider';

import { fetchStats } from './api';
import { keys } from './keys';
import {
  wireToHole,
  wireToPutt,
  wireToReview,
  wireToRound,
  wireToShot,
} from './types';

// The lifetime-stats corpus: every live row, one request (replaces the old
// five parallel whole-table SQLite reads in progress-view / map-page / profile).

export type StatsBundle = {
  rounds: Round[];
  holes: Hole[];
  shots: Shot[];
  putts: Putt[];
  reviews: PostRoundReview[];
};

export function useStatsBundle() {
  const uid = useUserId();
  return useQuery({
    queryKey: keys.stats(uid),
    enabled: uid !== '',
    queryFn: async (): Promise<StatsBundle> => {
      const res = await fetchStats();
      return {
        rounds: res.rounds.map(wireToRound),
        holes: res.holes.map(wireToHole),
        shots: res.shots.map(wireToShot),
        putts: res.putts.map(wireToPutt),
        reviews: res.reviews.map(wireToReview),
      };
    },
  });
}
