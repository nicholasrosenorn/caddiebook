import { router } from 'expo-router';

import { Tour } from '@/components/tour';

// The tour as a pushable modal route — opened from the Me-tab CTA, the
// sparse-data nudge, and the dev "Replay tour" button. (It also auto-presents
// once after sign-in; see the effect in app/_layout.tsx.) Closing just pops the
// modal; Tour itself persists the seen flag and fires the review prompt.
export default function TourScreen() {
  return <Tour onDone={() => router.back()} />;
}
