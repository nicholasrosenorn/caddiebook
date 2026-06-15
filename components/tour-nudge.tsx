import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useStatsBundle } from '@/lib/data/stats';
import { getPref, setPref } from '@/lib/local/prefs';
import { TOUR_NUDGE_DISMISSED_KEY, TOUR_SEEN_KEY } from '@/lib/tour';

// A quiet floating pill on the Me tab inviting a still-empty player to (re)take
// the tour. It only appears once the auto-presented tour has been seen, the
// player still has very few rounds, and they haven't dismissed it — so it never
// competes with the first-login setup coachmark and never nags an active player.
const FEW_ROUNDS = 3;

export function TourNudge() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  // Lift the pill clear of the bottom tab bar (insets.bottom alone leaves it
  // behind the bar, where the dismiss ✕ can't be tapped).
  const tabBarHeight = useBottomTabBarHeight();
  const { data } = useStatsBundle();

  // 'pending' until the prefs are read, so the pill never flashes before we know
  // whether the tour's been seen / the nudge dismissed.
  const [flag, setFlag] = useState<'pending' | 'eligible' | 'off'>('pending');
  useEffect(() => {
    let active = true;
    Promise.all([getPref(TOUR_SEEN_KEY), getPref(TOUR_NUDGE_DISMISSED_KEY)]).then(
      ([seen, dismissed]) => {
        if (active) setFlag(seen === '1' && dismissed !== '1' ? 'eligible' : 'off');
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const completedRounds = data ? data.rounds.filter((r) => r.completedAt != null).length : null;
  if (flag !== 'eligible' || completedRounds == null || completedRounds >= FEW_ROUNDS) return null;

  // Retire the nudge for good — used both by the ✕ and by opening the tour, so
  // tapping in once is enough to never see it again.
  const retire = () => {
    setFlag('off');
    void setPref(TOUR_NUDGE_DISMISSED_KEY, '1');
  };

  const openTour = () => {
    retire();
    router.push('/tour');
  };

  return (
    <View style={[styles.root, { bottom: tabBarHeight + spacing.sm }]} pointerEvents="box-none">
      {/* Two sibling touch targets (not nested), so the dismiss ✕ never gets
          swallowed by the open-tour press. */}
      <SketchSurface
        seed="tour-nudge"
        radius={12}
        fill={colors.accent}
        stroke={colors.accent}
        style={styles.pill}>
        <Pressable
          onPress={openTour}
          accessibilityRole="button"
          accessibilityLabel="Take the tour"
          style={({ pressed }) => [styles.openArea, pressed && styles.pressed]}>
          <IconSymbol name="sparkles" size={18} color={colors.accentOn} />
          <View style={styles.text}>
            <ThemedText style={styles.title}>Welcome to Caddie Book</ThemedText>
            <ThemedText style={styles.sub}>Take the 60 second tour to learn more.</ThemedText>
          </View>
        </Pressable>
        <Pressable
          onPress={retire}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={({ pressed }) => [styles.dismissBtn, pressed && styles.pressed]}>
          <IconSymbol name="xmark" size={15} color={colors.accentOn} />
        </Pressable>
      </SketchSurface>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      zIndex: 40,
    },
    pressed: { opacity: 0.7 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    openArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dismissBtn: {
      paddingLeft: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flex: 1, gap: 1 },
    title: {
      fontFamily: fonts.serifBold,
      fontSize: 15,
      lineHeight: 20,
      color: colors.accentOn,
    },
    sub: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 16,
      color: colors.accentOn,
      opacity: 0.85,
    },
  });
