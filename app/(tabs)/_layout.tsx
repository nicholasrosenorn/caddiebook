import { router, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, spacing } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Rounds',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="list.bullet" color={color} />,
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
        }}
      />
    </Tabs>
  );
}
