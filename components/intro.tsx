import { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ApproachTarget } from '@/components/approach-target';
import { Avatar } from '@/components/avatar';
import type { TargetPin } from '@/components/driver-target';
import { DriverTarget } from '@/components/driver-target';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, themes, type FontSet, type Palette } from '@/constants/theme';
import { ThemeContext, useColors, useFontSet } from '@/constants/theme-context';
import { topoRings } from '@/lib/sketch';

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

/**
 * One-time welcome flow. Rendered outside the router (see app/_layout) on first
 * launch, so it carries its own theme + safe-area providers. Tells the app's
 * story end to end — a drawn cover, the tap-first surfaces you record on, the
 * stats they roll up into, and the friends you share them with — then hands off
 * to the app via onDone.
 *
 * The flow is pinned to the Augusta (editorial) theme via a scoped ThemeContext
 * so the welcome always reads as the crisp editorial showcase, regardless of the
 * theme a returning user has chosen.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  const editorialTheme = useMemo(
    () => ({
      themeId: themes.augusta.id,
      palette: themes.augusta.palette,
      fonts: themes.augusta.fonts,
      chrome: themes.augusta.chrome,
      setTheme: () => {},
    }),
    [],
  );
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={editorialTheme}>
        <IntroFlow onDone={onDone} />
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

function IntroFlow({ onDone }: { onDone: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Page content uses symmetric horizontal padding (lg each side) — see pageContent.
  const contentWidth = windowWidth - spacing.lg * 2;
  const approachSize = Math.min(300, contentWidth);
  const heroSize = Math.min(232, contentWidth * 0.7);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToPage = useCallback(
    (page: number) => {
      if (pageHeight == null) return;
      scrollRef.current?.scrollTo({ y: page * pageHeight, animated: true });
    },
    [pageHeight],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageHeight == null) return;
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.min(TOTAL_PAGES - 1, Math.max(0, Math.round(y / pageHeight)));
    if (idx !== currentPage) setCurrentPage(idx);
  };

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
              <ScrollView
                ref={scrollRef}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}>
                <CoverPage height={pageHeight} heroSize={heroSize} onCta={() => scrollToPage(1)} />

                <IntroPage
                  height={pageHeight}
                  caption="Drives"
                  title="Mark it in the fairway."
                  body="Record every drive with a simple tap. Every drive drops a pin and your dispersion draws itself."
                  visual={<DriverTarget pins={DRIVE_PINS} width={220} height={370} />}
                  cta="Next"
                  onCta={() => scrollToPage(2)}
                />

                <IntroPage
                  height={pageHeight}
                  caption="Approaches"
                  title="Place it on the green."
                  body="One tap sets your proximity to the pin. Greens in regulation and putts by distance derive themselves."
                  visual={<ApproachTarget pins={APPROACH_PINS} size={approachSize} />}
                  cta="Next"
                  onCta={() => scrollToPage(3)}
                />

                <IntroPage
                  height={pageHeight}
                  caption="Your game"
                  title="Watch the picture sharpen."
                  body="Every round feeds your stats, your trends, and a real handicap index — so you always know what to work on."
                  visual={<InsightPlate />}
                  cta="Next"
                  onCta={() => scrollToPage(4)}
                />

                <IntroPage
                  height={pageHeight}
                  caption="Playing partners"
                  title="Share the good ones."
                  body="Post a round, follow your friends, and cheer each other on. Your best days don't stay in your pocket."
                  visual={<FeedCard />}
                  cta="Start tracking"
                  onCta={onDone}
                  primary
                />
              </ScrollView>

              <PageDots totalPages={TOTAL_PAGES} currentPage={currentPage} />
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

// The opening cover — a drawn green-contour "course plate" with a flag as the
// hero, the wordmark lockup beneath it, then the value-prop line + CTA. An open
// editorial cover, not a boxed certificate.
function CoverPage({
  height,
  heroSize,
  onCta,
}: {
  height: number;
  heroSize: number;
  onCta: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.coverHeroGroup}>
          <CoverHero size={heroSize} />
          <View style={styles.coverTitle}>
            <ThemedText type="caption" style={styles.kicker}>
              A GOLFER&apos;S FIELD NOTEBOOK
            </ThemedText>
            <ThemedText style={styles.coverWordmark} numberOfLines={1} adjustsFontSizeToFit>
              Caddie Book
            </ThemedText>
            <View style={styles.coverDivider}>
              <Rule />
            </View>
            <ThemedText style={styles.coverTagline}>Track every shot. Visualize your game.</ThemedText>
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText type="muted" style={[styles.body, styles.coverBody]}>
            Tap shapes that mean something to log a hole — months of rounds become trends,
            dispersion maps, and a real handicap.
          </ThemedText>
          <CtaButton label="Show me" onPress={onCta} />
        </View>
      </View>
    </View>
  );
}

// A bespoke cover illustration: a green drawn in plan view (a faint wash + rough
// contour rings via topoRings) with a flag rising from the cup, framed by two
// faint crop marks. Decorative — pointerEvents none. Two colors only.
function CoverHero({ size }: { size: number }) {
  const colors = useColors();
  const cx = size / 2;
  const cy = size * 0.56;
  const maxR = size * 0.36;
  const rings = useMemo(() => topoRings(cx, cy, maxR, 4, 'cover-green'), [cx, cy, maxR]);
  const stickTop = size * 0.12;
  const pennant = `M${cx} ${stickTop} L${cx + size * 0.15} ${stickTop + size * 0.045} L${cx} ${
    stickTop + size * 0.09
  } Z`;
  const crop = size * 0.06;
  const tick = size * 0.06;
  return (
    <Svg width={size} height={size} pointerEvents="none">
      <Circle cx={cx} cy={cy} r={maxR} fill={colors.accent} fillOpacity={0.08} />
      {rings.map((d, i) => (
        <Path key={i} d={d} stroke={colors.borderStrong} strokeWidth={1} fill="none" opacity={0.6} />
      ))}
      <Line x1={cx} y1={cy} x2={cx} y2={stickTop} stroke={colors.accent} strokeWidth={1.6} />
      <Path d={pennant} fill={colors.accent} />
      <Circle cx={cx} cy={cy} r={size * 0.018} fill={colors.accent} />
      {/* crop marks — top-left + bottom-right, an architect's-plate framing */}
      <Line x1={crop} y1={crop} x2={crop + tick} y2={crop} stroke={colors.borderStrong} strokeWidth={1} />
      <Line x1={crop} y1={crop} x2={crop} y2={crop + tick} stroke={colors.borderStrong} strokeWidth={1} />
      <Line
        x1={size - crop}
        y1={size - crop}
        x2={size - crop - tick}
        y2={size - crop}
        stroke={colors.borderStrong}
        strokeWidth={1}
      />
      <Line
        x1={size - crop}
        y1={size - crop}
        x2={size - crop}
        y2={size - crop - tick}
        stroke={colors.borderStrong}
        strokeWidth={1}
      />
    </Svg>
  );
}

function IntroPage({
  height,
  caption,
  title,
  body,
  visual,
  cta,
  onCta,
  primary = false,
}: {
  height: number;
  caption: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  cta: string;
  onCta: () => void;
  primary?: boolean;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.headerBlock}>
          <ThemedText type="caption" style={styles.kicker}>
            {caption.toUpperCase()}
          </ThemedText>
          <ThemedText style={styles.pageTitle}>{title}</ThemedText>
        </View>

        <View style={styles.visual}>{visual}</View>

        <View style={styles.footer}>
          <ThemedText type="muted" style={styles.body}>
            {body}
          </ThemedText>
          <CtaButton label={cta} onPress={onCta} primary={primary} />
        </View>
      </View>
    </View>
  );
}

// A crisp editorial surface: a hairline-framed card/button — the drawn-line
// SketchSurface's calm cousin, with no jitter and no grain.
function Plate({
  fill,
  stroke,
  radius = 12,
  style,
  children,
  ...rest
}: ViewProps & { fill?: string; stroke?: string; radius?: number }) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: fill ?? colors.surface,
          borderColor: stroke ?? colors.border,
          borderWidth: 1,
          borderRadius: radius,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

// A hairline rule — the crisp replacement for the wavy SketchDivider.
function Rule() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.border }} />;
}

// The CTA — a hairline-outlined button, or a filled pine plate for the final
// "Start tracking".
function CtaButton({
  label,
  onPress,
  primary = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}>
      <Plate
        fill={primary ? colors.accent : colors.surface}
        stroke={primary ? colors.accent : colors.borderStrong}
        radius={10}
        style={styles.cta}>
        <ThemedText style={[styles.ctaLabel, primary && styles.ctaLabelPrimary]}>{label}</ThemedText>
      </Plate>
    </Pressable>
  );
}

// Page-4 payoff: a single composed "report card" plate — handicap index, a
// scoring trend, and a couple of headline rates. One cohesive surface rather
// than several charts competing for the page.
function InsightPlate() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Plate radius={14} style={styles.report}>
      <View style={styles.reportHead}>
        <ThemedText type="caption" style={styles.kicker}>
          HANDICAP INDEX
        </ThemedText>
        <ThemedText style={styles.handicap}>8.4</ThemedText>
      </View>

      <Rule />

      <ThemedText type="caption" style={[styles.reportLabel, styles.kicker]}>
        SCORING — LAST 6
      </ThemedText>
      <TrendChart
        points={SCORE_TREND}
        height={66}
        baseline={0}
        baselineLabel="E"
        formatValue={fmtToPar}
      />

      <Rule />

      <View style={styles.statRow}>
        <MiniStat label="GIR" value="61%" />
        <MiniStat label="FIR" value="57%" />
        <MiniStat label="PUTTS / RD" value="30" />
      </View>
    </Plate>
  );
}

// Page-5 payoff: a representative friend's round, drawn with the same vocabulary
// as the real community feed card.
function FeedCard() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Plate radius={14} style={styles.feed}>
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

      <Rule />

      <View style={styles.feedStats}>
        <MiniStat label="GIR" value="72%" />
        <MiniStat label="FIR" value="64%" />
        <MiniStat label="PUTTS" value="28" />
        <View style={styles.likeBlock}>
          <IconSymbol name="hand.thumbsup.fill" size={20} color={colors.accent} />
          <ThemedText style={styles.likeCount}>12</ThemedText>
        </View>
      </View>
    </Plate>
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

function PageDots({ totalPages, currentPage }: { totalPages: number; currentPage: number }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.dotsContainer} pointerEvents="none">
      {Array.from({ length: totalPages }).map((_, i) => (
        <View key={i} style={[styles.dot, currentPage === i && styles.dotActive]} />
      ))}
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
    headerBlock: {
      gap: spacing.sm,
    },
    pageTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 33,
      lineHeight: 39,
      letterSpacing: -0.4,
      color: colors.textPrimary,
    },
    kicker: {
      fontWeight: '500',
      letterSpacing: 2,
      color: colors.textMuted,
    },
    visual: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footer: {
      gap: spacing.lg,
    },
    body: {
      fontSize: 17,
      lineHeight: 27,
    },
    ctaWrap: {
      minHeight: 52,
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
      color: colors.textPrimary,
    },
    ctaLabelPrimary: {
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
    coverTitle: {
      alignItems: 'center',
    },
    coverWordmark: {
      fontFamily: fonts.serifBold,
      fontSize: 44,
      lineHeight: 50,
      color: colors.textPrimary,
      textAlign: 'center',
      marginTop: spacing.xs,
      letterSpacing: -0.5,
    },
    coverDivider: {
      width: 72,
      marginVertical: spacing.sm,
    },
    coverTagline: {
      fontFamily: fonts.serif,
      fontSize: 15,
      lineHeight: 21,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    coverBody: {
      textAlign: 'center',
    },
    // Insight report card
    report: {
      width: '100%',
      padding: spacing.lg,
      gap: spacing.sm,
    },
    reportHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    handicap: {
      fontFamily: fonts.serifBold,
      fontSize: 38,
      lineHeight: 42,
      color: colors.accent,
    },
    reportLabel: {
      marginTop: spacing.xs,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
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
    // Community feed card
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
    dotsContainer: {
      position: 'absolute',
      right: 10,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      gap: 8,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.borderStrong,
    },
    dotActive: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
    },
  });
