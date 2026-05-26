import { useCallback, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApproachTarget } from '@/components/approach-target';
import type { TargetPin } from '@/components/driver-target';
import { DriverTarget } from '@/components/driver-target';
import { Board as PuttBoard } from '@/components/putting-page';
import { Screen } from '@/components/screen';
import { Crosshair, SketchSurface, TickPair } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { WedgeRangeChart, type RowKey } from '@/components/wedge-range-chart';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import type { Putt } from '@/db/types';

const TOTAL_PAGES = 4;

// WedgeRangeChart renders at a fixed internal height; PuttBoard's height is
// content-driven (header + 5 lanes + padding). These feed the scaled clip boxes
// on the final page — generous enough that nothing meaningful is cropped.
const WEDGE_CHART_HEIGHT = 300;
const PUTT_BOARD_WIDTH = 300;
const PUTT_BOARD_HEIGHT = 360;

// Sample carries (yds) so the range chart looks lived-in. The grid below it in
// the real tool is the editor; here it's a static read-out.
const SAMPLE_WEDGES = ['PW', '50°', '54°', '58°'];
const SAMPLE_CARRY: Record<string, Record<RowKey, number>> = {
  PW: { full: 125, tq: 112, half: 95, quarter: 78 },
  '50°': { full: 108, tq: 96, half: 82, quarter: 66 },
  '54°': { full: 92, tq: 82, half: 70, quarter: 55 },
  '58°': { full: 78, tq: 68, half: 56, quarter: 42 },
};
const sampleCarry = (club: string, row: RowKey): number | null =>
  SAMPLE_CARRY[club]?.[row] ?? null;

// A handful of putts across the distance bands so the board shows made/missed
// glyphs. holeNumber matches the board's so they render at full strength; the
// whole board is non-interactive in the intro (pointerEvents="none").
const SAMPLE_PUTTS: Putt[] = [
  { distanceFt: 3, made: true },
  { distanceFt: 3, made: true },
  { distanceFt: 10, made: true },
  { distanceFt: 10, made: false },
  { distanceFt: 15, made: false },
  { distanceFt: 25, made: false },
  { distanceFt: 50, made: false },
].map((p, i) => ({
  id: `intro-putt-${i}`,
  roundId: 'intro',
  holeNumber: 1,
  createdAt: '',
  ...p,
}));

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

/**
 * One-time welcome flow. Rendered outside the router (see app/_layout) on first
 * launch, so it carries its own theme + safe-area providers. Tells the app's
 * story by reusing the real play surfaces — tap a drive, place an approach,
 * read your score in shapes — then hands off to the app via onDone.
 */
export function Intro({ onDone }: { onDone: () => void }) {
  return (
    <SafeAreaProvider>
      <IntroFlow onDone={onDone} />
    </SafeAreaProvider>
  );
}

function IntroFlow({ onDone }: { onDone: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Page content padding is paddingLeft (lg) + paddingRight (xl) — see pageContent.
  const contentWidth = windowWidth - (spacing.lg + spacing.xl);
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
    <Screen padded={false}>
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
                <IntroPage
                  height={pageHeight}
                  caption="Caddie Book"
                  title="A pocket caddie for the thinking golfer."
                  body="Built for golfers who want to track, analyze, and improve their game. No stats are more than a tap away, and every shot is a chance to learn."
                  visual={
                    <View style={styles.welcomeMark}>
                      <Crosshair size={64} strokeWidth={1.4} />
                      <TickPair width={40} />
                    </View>
                  }
                  cta="Show me"
                  onCta={() => scrollToPage(1)}
                />

                <IntroPage
                  height={pageHeight}
                  caption="Drives"
                  title="Mark it in the fairway."
                  body="Left, center, or right of the fairway. Every drive drops a pin, and your dispersion draws itself."
                  visual={<DriverTarget pins={DRIVE_PINS} width={220} height={370} />}
                  cta="Next"
                  onCta={() => scrollToPage(2)}
                />

                <IntroPage
                  height={pageHeight}
                  caption="Approaches"
                  title="Place it on the green."
                  body="Proximity to the pin and greens-in-regulation derive themselves from a single tap on the target."
                  visual={<ApproachTarget pins={APPROACH_PINS} size={300} />}
                  cta="Next"
                  onCta={() => scrollToPage(3)}
                />

                <IntroPage
                  height={pageHeight}
                  caption="Dial it in"
                  title="Sharpen the scoring clubs."
                  body="Map your wedge yardages, and log every putt by distance — made or missed."
                  visual={
                    <View style={styles.toolsColumn}>
                      <ScaledBox width={contentWidth} height={WEDGE_CHART_HEIGHT} scale={0.58}>
                        <WedgeRangeChart
                          wedges={SAMPLE_WEDGES}
                          getValue={sampleCarry}
                          selected={null}
                        />
                      </ScaledBox>
                      <ScaledBox width={PUTT_BOARD_WIDTH} height={PUTT_BOARD_HEIGHT} scale={0.5}>
                        <View pointerEvents="none">
                          <PuttBoard
                            width={PUTT_BOARD_WIDTH}
                            putts={SAMPLE_PUTTS}
                            holeNumber={1}
                            onAdd={() => {}}
                            onRemove={() => {}}
                          />
                        </View>
                      </ScaledBox>
                    </View>
                  }
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
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        <View style={styles.headerBlock}>
          <ThemedText type="caption">{caption.toUpperCase()}</ThemedText>
          <ThemedText type="title">{title}</ThemedText>
        </View>

        <View style={styles.visual}>{visual}</View>

        <View style={styles.footer}>
          <ThemedText type="muted" style={styles.body}>
            {body}
          </ThemedText>
          <Pressable
            onPress={onCta}
            style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}>
            <SketchSurface
              seed={`intro-cta-${caption}`}
              fill={primary ? colors.accent : colors.surface}
              stroke={primary ? colors.accent : colors.borderStrong}
              grain={primary}
              style={styles.cta}>
              <ThemedText style={[styles.ctaLabel, primary && styles.ctaLabelPrimary]}>
                {cta}
              </ThemedText>
            </SketchSurface>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Renders a fixed-size visual at a smaller footprint by scaling from the
// top-left and clipping to the scaled box — so two tall charts fit one page
// without leaving the centered-scale gaps a bare transform would.
function ScaledBox({
  width,
  height,
  scale,
  children,
}: {
  width: number;
  height: number;
  scale: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ width: width * scale, height: height * scale, overflow: 'hidden' }}>
      <View style={{ width, height, transformOrigin: 'top left', transform: [{ scale }] }}>
        {children}
      </View>
    </View>
  );
}

function PageDots({ totalPages, currentPage }: { totalPages: number; currentPage: number }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.dotsContainer} pointerEvents="none">
      {Array.from({ length: totalPages }).map((_, i) => (
        <View key={i} style={[styles.dot, currentPage === i && styles.dotActive]} />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pageContent: {
      flex: 1,
      paddingLeft: spacing.lg,
      paddingRight: spacing.xl,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    headerBlock: {
      gap: spacing.sm,
    },
    visual: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    welcomeMark: {
      alignItems: 'center',
      gap: spacing.lg,
    },
    footer: {
      gap: spacing.lg,
    },
    body: {
      fontSize: 17,
      lineHeight: 24,
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
      fontFamily: fontFamily.serif,
      fontSize: 17,
      color: colors.textPrimary,
    },
    ctaLabelPrimary: {
      color: colors.accentOn,
    },
    pressed: {
      opacity: 0.6,
    },
    toolsColumn: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
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
