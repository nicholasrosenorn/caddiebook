import { Screen } from '@/components/screen';

// The Play tab never actually renders: its tab press is intercepted in the tab
// layout to open the New Round modal. This placeholder exists only so the route
// is registered. On iOS 26+ the tab is replaced by a floating "+" accessory and
// this route is unused; on older OSes it shows inline as the middle tab.
export default function PlayScreen() {
  return <Screen />;
}
