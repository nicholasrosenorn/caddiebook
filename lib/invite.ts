import { Alert, Share } from 'react-native';

import { getInviteLink } from './api/client';

// Each account has one stable invite link; fetching it mints one server-side the
// first time. Cache it for the session so repeated taps don't re-hit the network.
let cachedUrl: string | null = null;

export async function getMyInviteUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl;
  const { url } = await getInviteLink();
  cachedUrl = url;
  return url;
}

// Drop the cached link (e.g. on sign-out so the next account fetches its own).
export function clearInviteCache(): void {
  cachedUrl = null;
}

// Open the native share sheet with my invite link. Opening it auto-friends both
// of us once the recipient taps it in the app.
export async function shareInviteLink(): Promise<void> {
  let url: string;
  try {
    url = await getMyInviteUrl();
  } catch {
    Alert.alert('Could not create your invite link', 'Check your connection and try again.');
    return;
  }
  try {
    await Share.share({
      message: `Add me on Caddie Book 🏌️ ${url}`,
      url,
    });
  } catch {
    // User dismissed the sheet or it failed to open — nothing to do.
  }
}
