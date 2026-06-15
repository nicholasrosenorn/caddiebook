import * as StoreReview from 'expo-store-review';
import { Linking } from 'react-native';

import { setPref } from '@/lib/local/prefs';

// User-initiated App Store / Play Store rating ask (the tour's "Review Caddie
// Book" button / star tap). Because it's an explicit tap we always attempt it —
// no one-shot gate — and fall back to the store listing when the in-app sheet
// isn't available.
//
// NOTE: Apple's native in-app review sheet (`SKStoreReviewController`) is a
// deliberate no-op on the Simulator and in most dev / TestFlight contexts — it
// only actually renders in a production App Store build, and even then the OS
// rate-limits it. So "nothing happens" in development is expected.

export const STORE_REVIEW_REQUESTED_KEY = 'store_review_requested';

export async function requestStoreReview(): Promise<void> {
  // Kept as a record (read by the dev "Replay tour" reset); no longer gates the
  // ask, since this is now an explicit, user-initiated action.
  void setPref(STORE_REVIEW_REQUESTED_KEY, '1');

  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
      return;
    }
    // No in-app review available — open the store listing if one is configured
    // (ios.appStoreUrl / android.playStoreUrl in app config).
    const url = StoreReview.storeUrl();
    if (url) await Linking.openURL(url);
  } catch (err) {
    // Most often: the native module isn’t in the running binary yet — rebuild the
    // dev client after adding expo-store-review.
    console.warn('Store review request failed', err);
  }
}
