import { router, Stack } from 'expo-router';

import { HeaderIconButton } from '@/components/header-icon-button';
import { MenuButton } from '@/components/menu-button';
import { useColors, useFontSet } from '@/constants/theme-context';

export default function ProfileStackLayout() {
  const colors = useColors();
  const fonts = useFontSet();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontFamily: fonts.serifBold,
          fontSize: 22,
          lineHeight: 30,
        },
        headerShadowVisible: false,
      }}>
      <Stack.Screen
        name="index"
        options={{
          title: '',
          headerLeft: () => <MenuButton />,
          headerRight: () => (
            <HeaderIconButton
              name="gearshape"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
            />
          ),
        }}
      />
    </Stack>
  );
}
