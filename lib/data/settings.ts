import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useUserId } from '@/lib/auth/provider';

import { fetchSettings } from './api';
import { keys } from './keys';
import { enqueue } from './outbox';
import { queryClient } from './query-client';

// Account settings (the old app_settings table): one query holds the whole
// key→value map; typed accessors parse the JSON-valued keys (bag, yardages,
// wedge partials). Device-local prefs (theme, intro) live in lib/local/prefs.

const BAG_KEY = 'bag';
const CLUB_YARDAGES_KEY = 'club_yardages';
const WEDGE_PARTIALS_KEY = 'wedge_partials';

export type WedgePartials = { tq: number | null; half: number | null; quarter: number | null };
const EMPTY_PARTIALS: WedgePartials = { tq: null, half: null, quarter: null };

export type SettingsMap = Record<string, string>;

export function useSettingsMap() {
  const uid = useUserId();
  return useQuery({
    queryKey: keys.settings(uid),
    enabled: uid !== '',
    queryFn: async (): Promise<SettingsMap> => (await fetchSettings()).settings,
  });
}

function readSettings(uid: string): SettingsMap {
  return queryClient.getQueryData<SettingsMap>(keys.settings(uid)) ?? {};
}

export function useSetSetting() {
  const uid = useUserId();
  return useCallback(
    async (key: string, value: string): Promise<void> => {
      queryClient.setQueryData<SettingsMap>(keys.settings(uid), (prev) => ({
        ...(prev ?? {}),
        [key]: value,
      }));
      await enqueue({
        method: 'PUT',
        path: `/data/settings/${encodeURIComponent(key)}`,
        body: { value },
        touches: [keys.settings(uid)],
      });
    },
    [uid],
  );
}

// --- Parsers (semantics match the old db/queries accessors) -------------------

export function parseBag(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

export function parseClubYardages(value: string | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed == null || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [club, yds] of Object.entries(parsed)) {
      if (typeof yds === 'number' && Number.isFinite(yds)) out[club] = yds;
    }
    return out;
  } catch {
    return {};
  }
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function parseWedgePartials(value: string | undefined): Record<string, WedgePartials> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed == null || typeof parsed !== 'object') return {};
    const out: Record<string, WedgePartials> = {};
    for (const [club, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v == null || typeof v !== 'object') continue;
      const rec = v as Record<string, unknown>;
      out[club] = { tq: num(rec.tq), half: num(rec.half), quarter: num(rec.quarter) };
    }
    return out;
  } catch {
    return {};
  }
}

// --- Typed accessors -----------------------------------------------------------

export function useBag() {
  const settings = useSettingsMap();
  return { ...settings, bag: parseBag(settings.data?.[BAG_KEY]) };
}

export function useSetBag() {
  const setSetting = useSetSetting();
  return useCallback(
    (clubs: string[]) => setSetting(BAG_KEY, JSON.stringify(clubs)),
    [setSetting],
  );
}

export function useClubYardages() {
  const settings = useSettingsMap();
  return { ...settings, yardages: parseClubYardages(settings.data?.[CLUB_YARDAGES_KEY]) };
}

export function useSetClubYardage() {
  const uid = useUserId();
  const setSetting = useSetSetting();
  return useCallback(
    async (club: string, yds: number | null): Promise<void> => {
      const map = parseClubYardages(readSettings(uid)[CLUB_YARDAGES_KEY]);
      if (yds == null) delete map[club];
      else map[club] = yds;
      await setSetting(CLUB_YARDAGES_KEY, JSON.stringify(map));
    },
    [uid, setSetting],
  );
}

export function useWedgePartials() {
  const settings = useSettingsMap();
  return { ...settings, partials: parseWedgePartials(settings.data?.[WEDGE_PARTIALS_KEY]) };
}

export function useSetWedgePartial() {
  const uid = useUserId();
  const setSetting = useSetSetting();
  return useCallback(
    async (club: string, kind: keyof WedgePartials, yds: number | null): Promise<void> => {
      const map = parseWedgePartials(readSettings(uid)[WEDGE_PARTIALS_KEY]);
      const next: WedgePartials = { ...(map[club] ?? EMPTY_PARTIALS), [kind]: yds };
      if (next.tq == null && next.half == null && next.quarter == null) delete map[club];
      else map[club] = next;
      await setSetting(WEDGE_PARTIALS_KEY, JSON.stringify(map));
    },
    [uid, setSetting],
  );
}
