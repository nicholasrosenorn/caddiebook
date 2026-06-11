import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { ApproachTarget } from '@/components/approach-target';
import { Avatar } from '@/components/avatar';
import { CoverHero, CoverLockup, heroIn } from '@/components/cover-hero';
import type { TargetPin } from '@/components/driver-target';
import { DriverTarget } from '@/components/driver-target';
import { FirstRunTheme } from '@/components/first-run-theme';
import { Screen } from '@/components/screen';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { revealUp } from '@/lib/motion';

const TOTAL_PAGES = 5;

// A drive that found the fairway, framed by a few muted "other rounds" pins —
// the same dispersion overlay the round flow builds for real.
const DRIVE_PINS: TargetPin[] = [
  { xNorm: 0.5, yNorm: 0.42, variant: 'primary', key: 'd-main' },
  { xNorm: 0.38, yNorm: 0.55, variant: 'muted', key: 'd1' },
  { xNorm: 0.62, yNorm: 0.34, variant: 'muted', key: 'd2' },
  { xNorm: 0.2, yNorm: 0.6, variant: 'muted', key: 'd3' },
];

const APPROACH_PINS: TargetPin[] = [
  { xNorm: 0.5, yNorm: 0.41, variant: 'primary', key: 'a-main' },
  { xNorm: 0.58, yNorm: 0.55, variant: 'muted', key: 'a1' },
  { xNorm: 0.4, yNorm: 0.48, variant: 'muted', key: 'a2' },
  { xNorm: 0.66, yNorm: 0.36, variant: 'muted', key: 'a3' },
];

// Sample scoring (strokes to par, oldest → newest) for the insight trend — a
// game trending toward par. Static, like the dispersion pins above.
const SCORE_TREND = [7, 5, 6, 4, 3, 2];
const fmtToPar = (n: number) => {
  const r = Math.round(n);
  return r === 0 ? 'E' : r > 0 ? `+${r}` : `${r}`;
};

const lightTap = () => {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

const settleTap = () => {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.selectionAsync();
  }
};

/**
 * One-time welcome flow. Rendered outside the router (see app/_layout) on first
 * launch, so it carries its own theme + safe-area providers. Tells the app's
 * story end to end — a drawn cover, the tap-first surfaces you record on, the
 * stats they roll up into, and the friends you share them with — then hands off
 * to the app via onDone.
 *
 * Pinned to the Augusta (editorial) theme via FirstRunTheme. Editorial-pager
 * composition: each page is its own spread (a bleeding fairway, a cropped
 * approach circle, an open typographic stat plate, a feed deck) rather than a
 * repeated template. Swipe carries all navigation — the only button in the flow
 * is the final "Start tracking"; progress reads on a hairline rail, not dots.
 * Content reveals once, in a short stagger, the first time a page is focused.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  return (
    <FirstRunTheme>
      <IntroFlow onDone={onDone} />
    </FirstRunTheme>
  );
}

function IntroFlow({ onDone }: { onDone: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroSize = Math.min(232, (windowWidth - spacing.lg * 2) * 0.7);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  // Reveal-once flags per page; the cover (page 0) choreographs on mount.
  const [revealed, setRevealed] = useState<boolean[]>(() => {
    const initial = new Array<boolean>(TOTAL_PAGES).fill(false);
    initial[0] = true;
    return initial;
  });
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // Scroll position lives on the UI thread (it drives the progress rail); page
  // changes hop back to JS for state + a soft settle haptic.
  const scrollY = useSharedValue(0);
  const pageH = useSharedValue(0);
  const pageIdx = useSharedValue(0);
  useEffect(() => {
    if (pageHeight != null) pageH.value = pageHeight;
  }, [pageHeight, pageH]);

  const onPageSettle = useCallback((idx: number) => {
    setCurrentPage(idx);
    setRevealed((prev) => (prev[idx] ? prev : prev.map((r, i) => (i === idx ? true : r))));
    settleTap();
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    if (pageH.value <= 0) return;
    const idx = Math.min(TOTAL_PAGES - 1, Math.max(0, Math.round(e.contentOffset.y / pageH.value)));
    if (idx !== pageIdx.value) {
      pageIdx.value = idx;
      scheduleOnRN(onPageSettle, idx);
    }
  });

  const scrollToPage = useCallback(
    (page: number) => {
      if (pageHeight == null) return;
      scrollRef.current?.scrollTo({ y: page * pageHeight, animated: true });
    },
    [pageHeight, scrollRef],
  );

  return (
    <Screen padded={false} paper={false}>
      <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View
          style={styles.flex}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== pageHeight) setPageHeight(h);
          }}>
          {pageHeight !== null && (
            <>
              <Animated.ScrollView
                ref={scrollRef}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}>
                <CoverPage height={pageHeight} heroSize={heroSize} onAdvance={() => scrollToPage(1)} />
                <DrivesSpread
                  height={pageHeight}
                  revealed={revealed[1]}
                  onAdvance={() => scrollToPage(2)}
                />
                <ApproachSpread
                  height={pageHeight}
                  revealed={revealed[2]}
                  onAdvance={() => scrollToPage(3)}
                />
                <GameSpread
                  height={pageHeight}
                  revealed={revealed[3]}
                  onAdvance={() => scrollToPage(4)}
                />
                <PartnersSpread height={pageHeight} revealed={revealed[4]} onDone={onDone} />
              </Animated.ScrollView>

              <ProgressRail scrollY={scrollY} pageH={pageH} />
            </>
          )}
        </View>
      </View>

      {currentPage < TOTAL_PAGES - 1 && (
        <Pressable
          onPress={onDone}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Skip intro"
          style={({ pressed }) => [styles.skip, { top: insets.top + 8 }, pressed && styles.pressed]}>
          <ThemedText type="label" style={styles.skipLabel}>
            Skip
          </ThemedText>
        </Pressable>
      )}
    </Screen>
  );
}

// A reveal-once block: invisible until its page first scrolls into focus, then
// it fades up in stagger order. Swapping View → Animated.View remounts the
// node, which is what fires the entering animation exactly once.
function Reveal({
  revealed,
  order,
  style,
  children,
}: {
  revealed: boolean;
  order: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  if (!revealed) return <View style={[style, { opacity: 0 }]}>{children}</View>;
  return (
    <Animated.View entering={revealUp(order)} style={style}>
      {children}
    </Animated.View>
  );
}

// The reading-progress rail — a hairline on the right edge whose ink fill
// tracks the journey through the flow, in place of page dots. Transform-only,
// driven on the UI thread.
const RAIL_HEIGHT = 120;

function ProgressRail({
  scrollY,
  pageH,
}: {
  scrollY: SharedValue<number>;
  pageH: SharedValue<number>;
}) {
  const colors = useColors();
  const fillStyle = useAnimatedStyle(() => {
    const total = pageH.value * (TOTAL_PAGES - 1);
    const p = total > 0 ? Math.min(1, Math.max(0, scrollY.value / total)) : 0;
    return { transform: [{ translateY: -RAIL_HEIGHT * (1 - p) }] };
  });
  return (
    <View style={[railStyles.track, { backgroundColor: colors.border }]} pointerEvents="none">
      <Animated.View style={[railStyles.fill, { backgroundColor: colors.accent }, fillStyle]} />
    </View>
  );
}

const railStyles = StyleSheet.create({
  track: {
    position: 'absolute',
    right: 14,
    top: '50%',
    marginTop: -RAIL_HEIGHT / 2,
    width: 2,
    height: RAIL_HEIGHT,
    borderRadius: 1,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 2,
    height: RAIL_HEIGHT,
    borderRadius: 1,
  },
});

// The folio line — "01 · DRIVES" — the chapter mark of the sequence.
function Folio({ n, label, revealed }: { n: number; label: string; revealed: boolean }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Reveal revealed={revealed} order={0}>
      <ThemedText type="caption" style={styles.kicker}>
        {`0${n} · ${label.toUpperCase()}`}
      </ThemedText>
    </Reveal>
  );
}

// A gently bobbing chevron in the cover's footer: the swipe affordance that
// replaces a "Next" button. Tapping it advances too. The one looping animation
// in the flow — it communicates "there's more below", matching the round
// flow's scroll-hint convention.
function SwipeCue({ onPress }: { onPress: () => void }) {
  const colors = useColors();
  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [bob]);
  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 6 * bob.value }],
    opacity: 0.45 + 0.4 * bob.value,
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={lightTap}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Continue to the next page"
      style={cueStyles.wrap}>
      <Animated.View style={bobStyle}>
        <IconSymbol name="chevron.down" size={28} color={colors.accent} />
      </Animated.View>
    </Pressable>
  );
}

const cueStyles = StyleSheet.create({
  // Stretch + center so the chevron stays centered even inside footers that
  // align their copy to one side (e.g. the Approaches spread).
  wrap: { alignSelf: 'stretch', alignItems: 'center' },
});

// The opening cover — a drawn green-contour "course plate" with a flag as the
// hero, the wordmark lockup beneath it, then the value-prop line and a swipe
// cue. An open editorial cover, not a boxed certificate.
function CoverPage({
  height,
  heroSize,
  onAdvance,
}: {
  height: number;
  heroSize: number;
  onAdvance: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.coverHeroGroup}>
          <Animated.View entering={heroIn}>
            <CoverHero size={heroSize} />
          </Animated.View>
          <CoverLockup />
        </View>

        <View style={styles.footer}>
          <Animated.View entering={revealUp(6)}>
            <ThemedText type="muted" style={[styles.body, styles.coverBody]}>
              Built for the improving golfer — turn months of rounds into trends,
              dispersion maps, and a real handicap.
            </ThemedText>
          </Animated.View>
          <Animated.View entering={revealUp(7)}>
            <SwipeCue onPress={onAdvance} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

// Vertical room reserved for a spread's footer (a ~4-line body + the swipe
// cue + page padding) so the bleeding visuals can never run into the copy.
const FOOTER_CLEARANCE = 204;

// 01 · Drives — the tall fairway bleeds off the right edge, oversized, the
// headline overlapping its top rough; body copy tucked bottom-left.
function DrivesSpread({
  height,
  revealed,
  onAdvance,
}: {
  height: number;
  revealed: boolean;
  onAdvance: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  // Anchor below the headline and stop above the footer, whatever the screen.
  const targetTop = Math.max(150, Math.round(height * 0.2));
  const targetH = Math.min(440, height - targetTop - FOOTER_CLEARANCE);
  const targetW = Math.round(targetH * 0.56);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.spreadHeader}>
          <Folio n={1} label="Drives" revealed={revealed} />
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.pageTitle}>Mark it in{'\n'}the fairway.</ThemedText>
          </Reveal>
        </View>

        <Reveal revealed={revealed} order={2} style={[styles.driveBleed, { top: targetTop }]}>
          <View pointerEvents="none">
            <DriverTarget pins={DRIVE_PINS} width={targetW} height={targetH} />
          </View>
        </Reveal>

        <View style={styles.spreadFooter}>
          <Reveal revealed={revealed} order={3}>
            <ThemedText type="muted" style={[styles.body, styles.bodyNarrow]}>
              Record every drive with a simple tap. Every drive drops a pin and your dispersion
              draws itself.
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={4}>
            <SwipeCue onPress={onAdvance} />
          </Reveal>
        </View>
      </View>
    </View>
  );
}

// 02 · Approaches — the ring target bleeds off the LEFT edge as a big cropped
// circle; the body copy sits bottom-right to balance it.
function ApproachSpread({
  height,
  revealed,
  onAdvance,
}: {
  height: number;
  revealed: boolean;
  onAdvance: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { width: windowWidth } = useWindowDimensions();
  // Anchor below the headline and stop above the footer, whatever the screen.
  const circleTop = Math.max(168, Math.round(height * 0.24));
  const size = Math.min(Math.round(windowWidth * 0.92), height - circleTop - FOOTER_CLEARANCE);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.spreadHeader}>
          <Folio n={2} label="Approaches" revealed={revealed} />
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.pageTitle}>Place it on{'\n'}the green.</ThemedText>
          </Reveal>
        </View>

        <Reveal
          revealed={revealed}
          order={2}
          style={[styles.approachBleed, { top: circleTop, left: -Math.round(size * 0.36) }]}>
          <View pointerEvents="none">
            <ApproachTarget pins={APPROACH_PINS} size={size} />
          </View>
        </Reveal>

        <View style={[styles.spreadFooter, styles.spreadFooterRight]}>
          <Reveal revealed={revealed} order={3}>
            <ThemedText type="muted" style={[styles.body, styles.bodyNarrow]}>
              One tap sets your proximity to the pin. Greens in regulation and putts by distance
              derive themselves.
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={4} style={styles.cueReveal}>
            <SwipeCue onPress={onAdvance} />
          </Reveal>
        </View>
      </View>
    </View>
  );
}

// 03 · Your game — an open typographic plate, no card: the handicap index set
// huge in ink, a scoring trend, and the headline rates between hairline rules.
function GameSpread({
  height,
  revealed,
  onAdvance,
}: {
  height: number;
  revealed: boolean;
  onAdvance: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.spreadHeader}>
          <Folio n={3} label="Your game" revealed={revealed} />
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.pageTitle}>Watch the{'\n'}picture sharpen.</ThemedText>
          </Reveal>
        </View>

        <View style={styles.gamePlate}>
          <Reveal revealed={revealed} order={2}>
            <ThemedText style={styles.gameIndex}>8.4</ThemedText>
            <ThemedText type="caption" style={styles.kicker}>
              HANDICAP INDEX
            </ThemedText>
          </Reveal>

          <Reveal revealed={revealed} order={3}>
            <SketchDivider seed="game-rule-1" />
          </Reveal>

          <Reveal revealed={revealed} order={4}>
            <ThemedText type="caption" style={[styles.kicker, styles.gameTrendLabel]}>
              SCORING — LAST 6
            </ThemedText>
            <TrendChart
              points={SCORE_TREND}
              height={70}
              baseline={0}
              baselineLabel="E"
              formatValue={fmtToPar}
            />
          </Reveal>

          <Reveal revealed={revealed} order={5}>
            <SketchDivider seed="game-rule-2" />
          </Reveal>

          <Reveal revealed={revealed} order={6} style={styles.statRow}>
            <MiniStat label="GIR" value="61%" />
            <MiniStat label="FIR" value="57%" />
            <MiniStat label="PUTTS / RD" value="30" />
          </Reveal>
        </View>

        <View style={styles.spreadFooter}>
          <Reveal revealed={revealed} order={7}>
            <ThemedText type="muted" style={styles.body}>
              Every round feeds your stats, your trends, and a real handicap index — so you always
              know what to work on.
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={8}>
            <SwipeCue onPress={onAdvance} />
          </Reveal>
        </View>
      </View>
    </View>
  );
}

// 04 · Partners — a friend's round as the real feed card, stacked on a ghost
// card to suggest the feed behind it. Ends on the flow's only button.
function PartnersSpread({
  height,
  revealed,
  onDone,
}: {
  height: number;
  revealed: boolean;
  onDone: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.spreadHeader}>
          <Folio n={4} label="Playing partners" revealed={revealed} />
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.pageTitle}>Share the{'\n'}good ones.</ThemedText>
          </Reveal>
        </View>

        <Reveal revealed={revealed} order={2} style={styles.deckWrap}>
          <View style={styles.deck}>
            <View style={styles.deckGhost} />
            <FeedCard />
          </View>
        </Reveal>

        <View style={styles.spreadFooter}>
          <Reveal revealed={revealed} order={3}>
            <ThemedText type="muted" style={styles.body}>
              Post a round, follow your friends, and cheer each other on. Your best days don&apos;t
              stay in your pocket.
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={4}>
            <CtaButton label="Start tracking" onPress={onDone} />
          </Reveal>
        </View>
      </View>
    </View>
  );
}

// The flow's single button — a filled pine plate. Press feedback is a physical
// scale-down + a light haptic.
function CtaButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={lightTap}
      style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}>
      <SketchSurface
        seed={`intro-cta-${label}`}
        fill={colors.accent}
        stroke={colors.accent}
        radius={10}
        style={styles.cta}>
        <ThemedText style={styles.ctaLabel}>{label}</ThemedText>
      </SketchSurface>
    </Pressable>
  );
}

// A representative friend's round, drawn with the same vocabulary as the real
// community feed card.
function FeedCard() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <SketchSurface seed="intro-feed" radius={14} stroke={colors.border} style={styles.feed}>
      <View style={styles.feedHead}>
        <Avatar avatar="flag.fill" size={40} seed="intro-feed-av" />
        <View style={styles.feedName}>
          <ThemedText style={styles.feedNameText}>Jordan Vale</ThemedText>
          <ThemedText type="muted" style={styles.feedHandle}>
            @birdiemaker
          </ThemedText>
        </View>
      </View>

      <View style={styles.feedMeta}>
        <ThemedText type="subtitle" numberOfLines={1} style={styles.feedCourse}>
          Pebble Dunes
        </ThemedText>
        <ThemedText type="caption">JUN 2</ThemedText>
      </View>

      <View style={styles.feedScore}>
        <ThemedText style={styles.feedToPar}>−3</ThemedText>
        <ThemedText style={styles.feedGross}>69</ThemedText>
      </View>

      <SketchDivider seed="intro-feed-rule" />

      <View style={styles.feedStats}>
        <MiniStat label="GIR" value="72%" />
        <MiniStat label="FIR" value="64%" />
        <MiniStat label="PUTTS" value="28" />
        <View style={styles.likeBlock}>
          <IconSymbol name="hand.thumbsup.fill" size={20} color={colors.accent} />
          <ThemedText style={styles.likeCount}>12</ThemedText>
        </View>
      </View>
    </SketchSurface>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.miniStat}>
      <ThemedText style={styles.miniValue}>{value}</ThemedText>
      <ThemedText type="caption">{label}</ThemedText>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pageContent: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
    },
    spreadHeader: {
      gap: spacing.sm,
      zIndex: 2,
    },
    pageTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 38,
      lineHeight: 44,
      letterSpacing: -0.6,
      color: colors.textPrimary,
    },
    kicker: {
      fontWeight: '500',
      letterSpacing: 2,
      color: colors.textMuted,
    },
    spreadFooter: {
      marginTop: 'auto',
      gap: spacing.lg,
      zIndex: 2,
    },
    spreadFooterRight: {
      alignItems: 'flex-end',
    },
    body: {
      fontSize: 17,
      lineHeight: 27,
    },
    bodyNarrow: {
      maxWidth: '64%',
    },
    // Bleeding visuals — vertical anchors are computed per-screen in the
    // spread components (see FOOTER_CLEARANCE).
    driveBleed: {
      position: 'absolute',
      right: -spacing.xl,
      zIndex: 1,
    },
    approachBleed: {
      position: 'absolute',
      zIndex: 1,
    },
    // Keeps the swipe cue centered inside footers that align copy to one side.
    cueReveal: {
      alignSelf: 'stretch',
    },
    ctaWrap: {
      minHeight: 52,
    },
    ctaPressed: {
      transform: [{ scale: 0.97 }],
    },
    cta: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    ctaLabel: {
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 23,
      color: colors.accentOn,
    },
    pressed: {
      opacity: 0.6,
    },
    // Cover
    coverHeroGroup: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    },
    coverBody: {
      textAlign: 'center',
    },
    footer: {
      gap: spacing.lg,
    },
    // Your game — open typographic plate
    gamePlate: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.md,
      zIndex: 2,
    },
    gameIndex: {
      fontFamily: fonts.serifBold,
      fontSize: 76,
      lineHeight: 82,
      letterSpacing: -1,
      color: colors.accent,
    },
    gameTrendLabel: {
      marginBottom: spacing.sm,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    miniStat: {
      gap: 2,
    },
    miniValue: {
      fontFamily: fonts.serifBold,
      fontSize: 20,
      lineHeight: 27,
      color: colors.textPrimary,
    },
    // Partners — feed deck
    deckWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    deck: {
      width: '100%',
    },
    deckGhost: {
      position: 'absolute',
      top: -10,
      left: 14,
      right: -10,
      bottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    feed: {
      width: '100%',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    feedHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    feedName: {
      flex: 1,
      gap: 1,
    },
    feedNameText: {
      fontFamily: fonts.serifBold,
      fontSize: 17,
      lineHeight: 23,
      color: colors.textPrimary,
    },
    feedHandle: {
      fontSize: 13,
    },
    feedMeta: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    feedCourse: {
      flex: 1,
    },
    feedScore: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    feedToPar: {
      fontFamily: fonts.serifBold,
      fontSize: 34,
      lineHeight: 38,
      color: colors.accent,
    },
    feedGross: {
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 24,
      color: colors.textMuted,
    },
    feedStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    likeBlock: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    likeCount: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textSecondary,
    },
    skip: {
      position: 'absolute',
      right: spacing.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      zIndex: 30,
    },
    skipLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
  });
