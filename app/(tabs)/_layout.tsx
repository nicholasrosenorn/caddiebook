import { router, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, fontFamily, spacing } from '@/constants/theme';

function MenuButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open menu"
      onPress={() => router.push('/menu')}
      hitSlop={12}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}>
      <IconSymbol name="line.3.horizontal" size={24} color={colors.accent} />
    </Pressable>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderStrong,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.serif,
          fontSize: 11,
          letterSpacing: 0.5,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: {
          color: colors.textPrimary,
          fontFamily: fontFamily.serifBold,
          fontSize: 22,
        },
        headerShadowVisible: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Rounds',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="list.bullet" color={color} />,
          headerLeft: () => <MenuButton />,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New round"
              onPress={() => router.push('/round/new')}
              hitSlop={12}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.md,
                opacity: pressed ? 0.6 : 1,
              })}>
              <IconSymbol name="plus" size={24} color={colors.accent} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
          headerLeft: () => <MenuButton />,
        }}
      />
    </Tabs>
  );
}
