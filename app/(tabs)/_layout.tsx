import { router, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { InfoHint } from '@/components/info-hint';
import { TabBarBackground } from '@/components/tab-bar-background';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, spacing } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

function MenuButton() {
  const colors = useColors();
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
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
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
