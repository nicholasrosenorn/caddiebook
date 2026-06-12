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
// Onboarding flags: set once the player opens the yardages tool / has seen the
// first-login coachmark. Stored account-side (not device prefs) so they ride the
// same reactive settings query the nudge reads — visiting clears the dot on the
// same frame — and so a returning player isn't re-onboarded on every device.
const YARDAGES_VISITED_KEY = 'yardages_visited';
const SETUP_TOOLTIP_SEEN_KEY = 'setup_tooltip_seen';

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
  // `bagSet` distinguishes a brand-new player (key absent → callers default to
  // all clubs) from one who deliberately cleared their bag to empty (key present,
  // value `[]` → honor it, so the bag editor's "Clear" actually clears).
  return {
    ...settings,
    bag: parseBag(settings.data?.[BAG_KEY]),
    bagSet: settings.data?.[BAG_KEY] != null,
  };
}

export function useSetBag() {
  const setSetting = useSetSetting();
  return useCallback(
    (clubs: string[]) => setSetting(BAG_KEY, JSON.stringify(clubs)),
    [setSetting],
  );
}

// Drives the gentle "fill out your data" nudge (the menu dot + first-login
// coachmark). It's an onboarding prompt, so it clears once the player has *been*
// to the yardages tool — visiting counts even if they set nothing — and never
// shows to a returning player who already has a bag or carries. Returns false
// while the query is still empty so the dot never flashes before the cache
// rehydrates.
export function useNeedsClubSetup(): boolean {
  const settings = useSettingsMap();
  if (!settings.data) return false;
  if (settings.data[YARDAGES_VISITED_KEY] === '1') return false;
  const bag = parseBag(settings.data[BAG_KEY]);
  const yardages = parseClubYardages(settings.data[CLUB_YARDAGES_KEY]);
  return bag.length === 0 || Object.keys(yardages).length === 0;
}

// Marks the yardages tool as visited (one-shot — guards against rewriting once
// set). Call it when the yardages screen mounts to retire the nudge.
export function useMarkYardagesVisited() {
  const uid = useUserId();
  const setSetting = useSetSetting();
  return useCallback(() => {
    if (readSettings(uid)[YARDAGES_VISITED_KEY] === '1') return;
    void setSetting(YARDAGES_VISITED_KEY, '1');
  }, [uid, setSetting]);
}

// The first-login coachmark pointing at the menu. Shows alongside the nudge
// until dismissed (tapping it, or opening the menu). Its own "seen" flag lets it
// retire independently of the dot, which lingers until the yardages visit.
export function useSetupTooltip(): { show: boolean; dismiss: () => void } {
  const uid = useUserId();
  const settings = useSettingsMap();
  const setSetting = useSetSetting();
  const needsSetup = useNeedsClubSetup();
  const seen = settings.data?.[SETUP_TOOLTIP_SEEN_KEY] === '1';
  const dismiss = useCallback(() => {
    if (readSettings(uid)[SETUP_TOOLTIP_SEEN_KEY] === '1') return;
    void setSetting(SETUP_TOOLTIP_SEEN_KEY, '1');
  }, [uid, setSetting]);
  return { show: needsSetup && !seen, dismiss };
}

// Dev-only: wipe the bag, carries, and both onboarding flags so the setup nudge
// (menu dot + first-login coachmark) replays from a clean slate. Reactive — the
// dot/tooltip reappear on the next render, no reload needed. Empty string reads
// back as unset through every parser above.
export function useResetSetupNudge() {
  const setSetting = useSetSetting();
  return useCallback(async () => {
    await Promise.all([
      setSetting(BAG_KEY, ''),
      setSetting(CLUB_YARDAGES_KEY, ''),
      setSetting(YARDAGES_VISITED_KEY, ''),
      setSetting(SETUP_TOOLTIP_SEEN_KEY, ''),
    ]);
  }, [setSetting]);
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
