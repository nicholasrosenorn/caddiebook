import { router } from 'expo-router';

import { HeaderIconButton } from '@/components/header-icon-button';
import { useNeedsClubSetup } from '@/lib/data/settings';

/** Hamburger button that opens the app menu. Used as the `headerLeft` of every tab. */
export function MenuButton() {
  // The hamburger only lives in tab headers (never inside a round), so the
  // setup nudge here is always in its "not in a round" context.
  const needsSetup = useNeedsClubSetup();
  return (
    <HeaderIconButton
      name="line.3.horizontal"
      accessibilityLabel="Open menu"
      badge={needsSetup}
      onPress={() => router.push('/menu')}
    />
  );
}
