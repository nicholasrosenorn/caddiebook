import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
  profile: 'account-circle',
  play: 'add-circle',
  community: 'groups',
} as const;

function useAndroidTabIcons() {
  const [icons, setIcons] = useState<Record<keyof typeof ANDROID_ICONS, ImageSourcePropType | null>>({
    profile: null,
    play: null,
    community: null,
  });

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    Promise.all([
      MaterialIcons.getImageSource(ANDROID_ICONS.profile, 26, '#000000'),
      MaterialIcons.getImageSource(ANDROID_ICONS.play, 26, '#000000'),
      MaterialIcons.getImageSource(ANDROID_ICONS.community, 26, '#000000'),
    ]).then(([profile, play, community]) => {
      if (active) setIcons({ profile, play, community });
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
        name="(profile)"
        options={{
          title: 'Me',
          tabBarIcon: () => icon('profile', 'person.crop.circle'),
        }}
      />
      <Tabs.Screen
        name="play"
        options={{
          title: 'Play',
          tabBarIcon: () => icon('play', 'plus.circle.fill'),
        }}
        // The Play tab is an action, not a destination: intercept the press and
        // open the New Round modal instead of switching to the (never-shown) screen.
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/round/new');
          },
        }}
      />
      <Tabs.Screen
        name="(community)"
        options={{
          title: 'Community',
          tabBarIcon: () => icon('community', 'person.2.fill'),
        }}
      />
    </Tabs>
  );
}
