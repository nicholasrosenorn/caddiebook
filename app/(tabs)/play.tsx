import { Screen } from '@/components/screen';

// The Play tab never actually renders: its tab press is intercepted in the tab
// layout to open the New Round modal. This placeholder exists only so the route
// is registered as a tab.
export default function PlayScreen() {
  return <Screen />;
}
