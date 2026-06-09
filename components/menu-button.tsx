import { router } from 'expo-router';

import { HeaderIconButton } from '@/components/header-icon-button';

/** Hamburger button that opens the app menu. Used as the `headerLeft` of every tab. */
export function MenuButton() {
  return (
    <HeaderIconButton
      name="line.3.horizontal"
      accessibilityLabel="Open menu"
      onPress={() => router.push('/menu')}
    />
  );
}
