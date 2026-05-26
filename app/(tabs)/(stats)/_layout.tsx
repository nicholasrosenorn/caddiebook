import { Stack } from 'expo-router';

import { MenuButton } from '@/components/menu-button';
import { fontFamily } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

export default function StatsStackLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontFamily: fontFamily.serifBold,
          fontSize: 22,
        },
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="stats"
        options={{
          title: 'Stats',
          headerLeft: () => <MenuButton />,
        }}
      />
    </Stack>
  );
}
