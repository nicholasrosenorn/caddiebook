import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/constants/theme-context';

/** Hamburger button that opens the app menu. Used as the `headerLeft` of every tab. */
export function MenuButton() {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      onPress={() => router.push('/menu')}
      hitSlop={12}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}>
      <IconSymbol name="line.3.horizontal" size={24} color={colors.accent} />
    </Pressable>
  );
}
