import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';
import type { AppleIcon } from 'react-native-bottom-tabs';

import { Tabs } from '@/components/bottom-tabs';
import { fontFamily } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

type TabIcon = ImageSourcePropType | AppleIcon;

// SF Symbols render natively on iOS; Android needs a rasterized ImageSource, which
// `@expo/vector-icons` only exposes asynchronously — so resolve those once at mount.
const ANDROID_ICONS = {
  rounds: 'format-list-bulleted',
  stats: 'bar-chart',
} as const;

function useAndroidTabIcons() {
  const [icons, setIcons] = useState<Record<keyof typeof ANDROID_ICONS, ImageSourcePropType | null>>({
    rounds: null,
    stats: null,
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    Promise.all([
      MaterialIcons.getImageSource(ANDROID_ICONS.rounds, 26, '#000000'),
      MaterialIcons.getImageSource(ANDROID_ICONS.stats, 26, '#000000'),
    ]).then(([rounds, stats]) => {
      if (active) setIcons({ rounds, stats });
    });
    return () => {
      active = false;
    };
  }, []);

  return icons;
}

export default function TabLayout() {
  const colors = useColors();
  const androidIcons = useAndroidTabIcons();

  const icon = (key: keyof typeof ANDROID_ICONS, sfSymbol: AppleIcon['sfSymbol']): TabIcon =>
    Platform.OS === 'ios' ? { sfSymbol } : (androidIcons[key] as TabIcon);

  return (
    <Tabs
      tabBarActiveTintColor={colors.accent}
      tabBarInactiveTintColor={colors.textMuted}
      tabBarStyle={{ backgroundColor: colors.surface }}
      tabLabelStyle={{ fontFamily: fontFamily.serif, fontSize: 11 }}
      activeIndicatorColor={colors.accentMuted}
      rippleColor={colors.accentMuted}
      hapticFeedbackEnabled
      translucent
      labeled>
      <Tabs.Screen
        name="(rounds)"
        options={{
          title: 'Rounds',
          tabBarIcon: () => icon('rounds', 'list.bullet'),
        }}
      />
      <Tabs.Screen
        name="(stats)"
        options={{
          title: 'Stats',
          tabBarIcon: () => icon('stats', 'chart.bar.fill'),
        }}
      />
    </Tabs>
  );
}
