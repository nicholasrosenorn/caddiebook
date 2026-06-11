import { authedRequest } from '@/lib/api/client';

import type {
  CoursesResponse,
  DataRoundsResponse,
  JournalResponse,
  RoundFullResponse,
  SettingsResponse,
  StatsBundleResponse,
} from './types';

// Typed fetchers over the server's /data CRUD API. Reads are used as react-query
// queryFns; writes normally go through the outbox (lib/data/outbox.ts) rather
// than being called directly, so replay order is preserved.

export const fetchRounds = () => authedRequest<DataRoundsResponse>('/data/rounds', 'GET');

export const fetchRoundFull = (roundId: string) =>
  authedRequest<RoundFullResponse>(`/data/rounds/${roundId}/full`, 'GET');

export const fetchStats = () => authedRequest<StatsBundleResponse>('/data/stats', 'GET');

export const fetchCourses = () => authedRequest<CoursesResponse>('/data/courses', 'GET');

export const fetchJournal = () => authedRequest<JournalResponse>('/data/journal', 'GET');

export const fetchSettings = () => authedRequest<SettingsResponse>('/data/settings', 'GET');
