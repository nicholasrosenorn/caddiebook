import { router, Stack } from 'expo-router';
import { Pressable } from 'react-native';

import { MenuButton } from '@/components/menu-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

export default function ProfileStackLayout() {
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
        name="index"
        options={{
          title: '',
          headerLeft: () => <MenuButton />,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}>
              <IconSymbol name="gearshape" size={24} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
