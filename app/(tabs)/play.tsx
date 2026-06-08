import { Screen } from '@/components/screen';

// The Play tab never actually renders: its tab press is intercepted in the tab
// layout to open the New Round modal. This placeholder exists only so the route
// is registered. On iOS 26+ the tab is given `role: 'search'`, so it appears as a
// detached glass button beside the bar; on older OSes it shows inline as a tab.
export default function PlayScreen() {
  return <Screen />;
}
