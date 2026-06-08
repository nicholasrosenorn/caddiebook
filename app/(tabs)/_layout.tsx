import { MaterialIcons } from '@expo/vector-icons';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppleIcon } from 'react-native-bottom-tabs';

import { Tabs } from '@/components/bottom-tabs';
import { GlassSurface } from '@/components/glass-surface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, type Palette } from '@/constants/theme';
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

  // On iOS 26+ the "+" becomes a floating liquid-glass accessory beside the bar;
  // everywhere else it stays an inline middle tab (Me · Play · Community).
  const floatingPlus = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const icon = (key: keyof typeof ANDROID_ICONS, sfSymbol: AppleIcon['sfSymbol']): TabIcon =>
    Platform.OS === 'ios' ? { sfSymbol } : (androidIcons[key] as TabIcon);

  return (
    <>
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
            // Hide the inline tab when the floating "+" is in use. The route stays
            // registered (the placeholder screen) but never surfaces in the bar.
            tabBarItemHidden: floatingPlus,
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
      {floatingPlus && <NewRoundButton />}
    </>
  );
}

// Floating liquid-glass "+" that opens the New Round flow. It deliberately sits
// outside the native tab bar — a separate accessory action to the bar's right,
// echoing the bar's glass material via `GlassSurface` (tinted to the accent ink).
function NewRoundButton() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Pressable
      onPress={() => router.push('/round/new')}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="New round"
      style={[styles.button, { bottom: insets.bottom + 12 }]}>
      {({ pressed }) => (
        <>
          <GlassSurface borderRadius={28} tintColor={colors.accent} />
          {pressed && <View style={styles.pressedOverlay} pointerEvents="none" />}
          <IconSymbol name="plus" size={26} color={colors.accentOn} />
        </>
      )}
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    button: {
      position: 'absolute',
      right: 16,
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 20,
    },
    pressedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.accentOn,
      opacity: 0.18,
    },
  });
