import { getPref, setPref } from '@/lib/local/prefs';

// Device-local flags for the post-sign-in tour. Like `intro_seen`, these are
// deliberately device prefs, not account settings: the tour is a one-time UX, so
// it's fine for it to replay on a fresh install, and these must be readable
// outside the data layer (the auto-present effect runs before any data query).

export const TOUR_SEEN_KEY = 'tour_seen';
export const TOUR_NUDGE_DISMISSED_KEY = 'tour_nudge_dismissed';

export async function hasSeenTour(): Promise<boolean> {
  return (await getPref(TOUR_SEEN_KEY)) === '1';
}

export async function markTourSeen(): Promise<void> {
  await setPref(TOUR_SEEN_KEY, '1');
}
