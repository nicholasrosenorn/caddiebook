import { router, Stack } from 'expo-router';
import { Pressable, View } from 'react-native';

import { InfoHint } from '@/components/info-hint';
import { MenuButton } from '@/components/menu-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, spacing } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

export default function RoundsStackLayout() {
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
          title: 'Rounds',
          headerLeft: () => <MenuButton />,
          headerRight: () => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
              }}>
              <InfoHint
                title="Managing rounds"
                message="Tap a round to open it. Press and hold a round to delete it."
                size={22}
                color={colors.accent}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New round"
                onPress={() => router.push('/round/new')}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
                <IconSymbol name="plus" size={24} color={colors.accent} />
              </Pressable>
            </View>
          ),
        }}
      />
    </Stack>
  );
}
