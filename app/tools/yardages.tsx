import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BagPicker } from '@/components/bag-picker';
import {
  ArcFlag,
  BagFan,
  CARRY_MAX,
  CARRY_MIN,
  CARRY_STEP,
  ClubArc,
  clubLoft,
  flagOffsetX,
  FLAG_W,
  xToCarry,
} from '@/components/club-arc';
import { InfoHint } from '@/components/info-hint';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS, sortByDriveLength } from '@/constants/clubs';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { listItemIn } from '@/lib/motion';
import {
  useBag,
  useClubYardages,
  useMarkYardagesVisited,
  useSetBag,
  useSetClubYardage,
} from '@/lib/data/settings';

const DEFAULT_YDS = 100;
const BAND_HEIGHT = 76;
const FAN_HEIGHT = 132;

const lightTap = () => {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
};

// Derive the in-play club list (Putter excluded, longest → shortest) from a bag.
function clubsFromBag(bag: string[]): string[] {
  const inBag = new Set(bag);
  return sortByDriveLength(CLUB_OPTIONS.filter((c) => c !== 'Putter' && inBag.has(c)));
}

export default function YardagesScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  // The cached settings query is the source of truth: the setters patch the
  // cache synchronously (optimistic) so the UI updates on the same frame.
  const { bag: storedBag, bagSet } = useBag();
  const { yardages } = useClubYardages();
  const setBag = useSetBag();
  const setClubYardage = useSetClubYardage();

  // Reaching this screen retires the onboarding nudge, even if nothing is set.
  const markVisited = useMarkYardagesVisited();
  useEffect(() => {
    markVisited();
  }, [markVisited]);

  // Unset bag (key absent) means "all clubs" everywhere else, so show that here
  // too; an explicitly-cleared bag (key present, empty) is honored.
  const bag = useMemo(
    () => (bagSet ? storedBag : [...CLUB_OPTIONS]),
    [bagSet, storedBag],
  );
  const clubs = useMemo(() => clubsFromBag(bag), [bag]);

  const onBagChange = useCallback(
    async (next: string[]) => {
      await setBag(next);
    },
    [setBag],
  );

  const onCommit = useCallback(
    async (club: string, next: number | null) => {
      await setClubYardage(club, next);
    },
    [setClubYardage],
  );

  const fanItems = useMemo(
    () =>
      clubs
        .filter((c) => yardages[c] != null)
        .map((c) => ({ carry: yardages[c], loft: clubLoft(c) })),
    [clubs, yardages],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        <BagPicker value={bag} onChange={onBagChange} label="My bag" />

        {fanItems.length >= 2 && <BagPlate items={fanItems} />}

        <View style={styles.introRow}>
          <ThemedText type="muted" style={styles.intro}>
            Tap the arc to set a carry. Use −/+ to fine-tune. Long-press a yardage to clear it.
          </ThemedText>
          <InfoHint
            title="Setting your yardages"
            message="Tap along each club's arc to drop a flag at your typical carry, then nudge it with the −/+ buttons. Once two or more clubs have a number, the full-bag fan plots them together. Long-press a yardage to clear it."
          />
        </View>

        {clubs.map((club, i) => (
          <Animated.View key={club} entering={listItemIn(i)}>
            <ArcCard
              club={club}
              yards={yardages[club] ?? null}
              onCommit={(next) => onCommit(club, next)}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </Screen>
  );
}

// The whole-bag silhouette plate: nested trajectories at a glance.
function BagPlate({ items }: { items: { carry: number; loft: number }[] }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };
  const carries = items.map((i) => i.carry);
  const lo = Math.min(...carries);
  const hi = Math.max(...carries);

  return (
    <SketchSurface seed="bag-fan" radius={12} style={styles.fanCard}>
      <ThemedText type="label" style={styles.fanKicker}>
        Full bag
      </ThemedText>
      <View style={styles.fanBand} onLayout={onLayout}>
        {width > 0 && <BagFan width={width} height={FAN_HEIGHT} items={items} />}
      </View>
      <ThemedText type="muted" style={styles.fanCaption}>
        {lo}–{hi} yds across {items.length} clubs
      </ThemedText>
    </SketchSurface>
  );
}

function ArcCard({
  club,
  yards,
  onCommit,
}: {
  club: string;
  yards: number | null;
  onCommit: (next: number | null) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [bandW, setBandW] = useState(0);
  const loft = useMemo(() => clubLoft(club), [club]);

  // The landing flag rides an animated overlay so it glides to a new carry on
  // commit while the dotted flight path redraws beneath it. `pulse` gives the
  // yardage a brief ink-tinted swell when it changes.
  const flagX = useSharedValue(0);
  const pulse = useSharedValue(1);
  const placed = useRef(false);
  const prevYards = useRef<number | null>(yards);

  // Glide the flag to the new carry. First placement (once the band is measured)
  // is instant so the flag doesn't fly in from the edge on mount.
  useEffect(() => {
    if (bandW <= 0) return;
    const target = flagOffsetX(yards ?? DEFAULT_YDS, bandW);
    if (!placed.current) {
      flagX.value = target;
      placed.current = true;
    } else {
      flagX.value = withTiming(target, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    }
  }, [yards, bandW, flagX]);

  // Swell the number when it lands on a new value (not on mount, not on clear).
  useEffect(() => {
    const prev = prevYards.current;
    prevYards.current = yards;
    if (yards == null || prev === yards) return;
    pulse.value = withSequence(
      withTiming(1.08, { duration: 90, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
      withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }),
    );
  }, [yards, pulse]);

  const flagStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: flagX.value }],
  }));
  const numStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    color: interpolateColor(pulse.value, [1, 1.08], [colors.textPrimary, colors.accent]),
  }));

  const onBandLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== bandW) setBandW(w);
  };

  const onTapBand = (e: GestureResponderEvent) => {
    if (bandW <= 0) return;
    const next = xToCarry(e.nativeEvent.locationX, bandW);
    if (next === yards) return;
    lightTap();
    onCommit(next);
  };

  const step = (dir: 1 | -1) => {
    if (yards == null) return;
    const next = Math.max(CARRY_MIN, Math.min(CARRY_MAX, yards + dir * CARRY_STEP));
    if (next === yards) return;
    lightTap();
    onCommit(next);
  };

  return (
    <SketchSurface seed={`yds-${club}`} radius={12} style={styles.card}>
      <View style={styles.head}>
        <ThemedText style={styles.club}>{club}</ThemedText>

        {yards == null ? (
          <ThemedText style={styles.empty}>tap to set</ThemedText>
        ) : (
          <View style={styles.stepperRow}>
            <PressableScale
              style={styles.stepBtn}
              hitSlop={8}
              onPress={() => step(-1)}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${club} carry`}>
              <ThemedText style={styles.stepGlyph}>−</ThemedText>
            </PressableScale>

            <Pressable
              onLongPress={() => onCommit(null)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${club} carry, ${yards} yards, long-press to clear`}>
              <Animated.Text style={[styles.yards, numStyle]}>
                {yards}
                <ThemedText style={styles.unit}> yds</ThemedText>
              </Animated.Text>
            </Pressable>

            <PressableScale
              style={styles.stepBtn}
              hitSlop={8}
              onPress={() => step(1)}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${club} carry`}>
              <ThemedText style={styles.stepGlyph}>+</ThemedText>
            </PressableScale>
          </View>
        )}
      </View>

      <View style={styles.band} onLayout={onBandLayout}>
        {bandW > 0 && (
          <>
            <ClubArc
              width={bandW}
              height={BAND_HEIGHT}
              carry={yards}
              active={yards != null}
              loft={loft}
              parkedAt={DEFAULT_YDS}
              flag={false}
            />
            <Animated.View pointerEvents="none" style={[styles.flagOverlay, flagStyle]}>
              <ArcFlag height={BAND_HEIGHT} set={yards != null} />
            </Animated.View>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onTapBand}
              accessibilityRole="button"
              accessibilityLabel={`${club} carry${yards != null ? `, ${yards} yards` : ''}, tap the arc to set`}
            />
          </>
        )}
      </View>
    </SketchSurface>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  content: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  intro: {
    flex: 1,
    fontSize: 13,
  },
  fanCard: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  fanKicker: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  fanBand: {
    height: FAN_HEIGHT,
  },
  fanCaption: {
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 2,
    paddingBottom: spacing.xs,
  },
  card: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  club: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  stepBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 26,
    color: colors.accent,
  },
  yards: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
    transformOrigin: 'right',
    minWidth: 58,
    textAlign: 'right',
  },
  unit: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textSecondary,
  },
  empty: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
  },
  band: {
    // The whole band height is the tap target; kept clear of the header so a
    // stepper tap never falls through to the arc's tap-to-place surface.
    height: BAND_HEIGHT,
    justifyContent: 'center',
  },
  flagOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: FLAG_W,
    height: BAND_HEIGHT,
  },
});
