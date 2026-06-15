import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
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
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Image } from 'expo-image';

import { GlassSurface } from '@/components/glass-surface';
import { MentalGameCard, ProgressViewBase } from '@/components/progress-view';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { JournalEntry, PreRoundGoals } from '@/lib/data/models';
import { GOAL_CATEGORIES } from '@/lib/goals';
import { journalTagLabel } from '@/lib/journal';
import { aggregateReview } from '@/lib/lifetime-stats';
import { revealUp } from '@/lib/motion';
import { requestStoreReview } from '@/lib/review-prompt';
import { buildSampleSeason, type SampleSeason } from '@/lib/sample-stats';
import { markTourSeen } from '@/lib/tour';

const RANGEFINDER_MEASURE = require('@/assets/images/tour-rangefinder-measure.png');
const RANGEFINDER_DISPERSION = require('@/assets/images/tour-rangefinder-dispersion.png');
// Cropped iPhone screenshots are 1206×2442 (status bar removed).
const SCREENSHOT_ASPECT = 1206 / 2442;

// The post-sign-in tour: a horizontally-paged narrative that leads with the
// payoff — a full, explorable example-season progress screen, rendered with the
// exact same component as the real Stats tab — then frames the remaining pages as
// deeper dives into the surfaces that built it, and ends with a concrete setup
// action. It reuses the first-run animation/layout vocabulary (paging, the
// reveal-once stagger, light haptics) in the user's chosen theme.

const lightTap = () => {
  if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};
const settleTap = () => {
  if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
};

const TOTAL_PAGES = 7;

/**
 * `onDone` closes the tour — `router.back()` when opened as a route (auto-present
 * and every replay both push `/tour`). Reaching the end (or skipping) marks the
 * tour seen so it never auto-presents again.
 */
export function Tour({ onDone }: { onDone: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // The example season is deterministic — build it once for every page that reads it.
  const season = useMemo(() => buildSampleSeason(), []);

  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [revealed, setRevealed] = useState<boolean[]>(() => {
    const initial = new Array<boolean>(TOTAL_PAGES).fill(false);
    initial[0] = true;
    return initial;
  });

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollX = useSharedValue(0);
  const pageW = useSharedValue(width);
  const idxSV = useSharedValue(0);
  useEffect(() => {
    pageW.value = width;
  }, [width, pageW]);

  const onPageSettle = useCallback((idx: number) => {
    setStep(idx);
    setRevealed((prev) => (prev[idx] ? prev : prev.map((r, i) => (i === idx ? true : r))));
    settleTap();
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
    if (pageW.value <= 0) return;
    const idx = Math.min(TOTAL_PAGES - 1, Math.max(0, Math.round(e.contentOffset.x / pageW.value)));
    if (idx !== idxSV.value) {
      idxSV.value = idx;
      scheduleOnRN(onPageSettle, idx);
    }
  });

  const scrollToStep = useCallback(
    (next: number) => {
      const target = Math.min(TOTAL_PAGES - 1, Math.max(0, next));
      scrollRef.current?.scrollTo({ x: target * width, animated: true });
    },
    [scrollRef, width],
  );

  const finish = useCallback(() => {
    // The rating ask lives on its own page now (RatingPage); finishing just
    // closes the tour.
    void markTourSeen();
    onDone();
  }, [onDone]);

  const setupBag = useCallback(() => {
    void markTourSeen();
    onDone();
    // Hand off to the bag + stock-yardages tool once the modal has closed.
    setTimeout(() => router.push('/tools/yardages'), 350);
  }, [onDone]);

  const skip = useCallback(() => {
    void markTourSeen();
    onDone();
  }, [onDone]);

  return (
    <Screen padded={false}>
      <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TopBar step={step} onBack={() => scrollToStep(step - 1)} />

        <View
          style={styles.flex}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== pageHeight) setPageHeight(h);
          }}>
          {pageHeight !== null && (
            <Animated.ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={16}>
              <ExampleSeasonPage
                width={width}
                height={pageHeight}
                season={season}
                onContinue={() => scrollToStep(1)}
              />
              <CourseManagementPage
                width={width}
                height={pageHeight}
                revealed={revealed[1]}
                onContinue={() => scrollToStep(2)}
              />
              <JournalPage
                width={width}
                height={pageHeight}
                revealed={revealed[2]}
                onContinue={() => scrollToStep(3)}
              />
              <GpsRangefinderPage
                width={width}
                height={pageHeight}
                revealed={revealed[3]}
                onContinue={() => scrollToStep(4)}
              />
              <ReviewDeepDivePage
                width={width}
                height={pageHeight}
                revealed={revealed[4]}
                season={season}
                onContinue={() => scrollToStep(5)}
              />
              <RatingPage
                width={width}
                height={pageHeight}
                revealed={revealed[5]}
                onContinue={() => scrollToStep(6)}
              />
              <FinishPage
                width={width}
                height={pageHeight}
                revealed={revealed[6]}
                onSetupBag={setupBag}
                onAllDone={finish}
              />
            </Animated.ScrollView>
          )}
        </View>

        <CloseButton top={insets.top + 8} onPress={skip} />
      </View>
    </Screen>
  );
}

// ── Page chrome ───────────────────────────────────────────────────────────────

function TopBar({ step, onBack }: { step: number; onBack: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.topBar}>
      <View style={styles.topSide}>
        {step > 0 && (
          <Pressable
            onPress={() => {
              lightTap();
              onBack();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Previous"
            style={({ pressed }) => pressed && styles.pressed}>
            <IconSymbol name="chevron.left" size={24} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <View style={styles.dots}>
        {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === step ? styles.dotActive : null,
              { backgroundColor: i === step ? colors.accent : colors.border },
            ]}
          />
        ))}
      </View>

      {/* Right spacer keeps the dots centered; the floating glass ✕ sits here. */}
      <View style={[styles.topSide, styles.topSideRight]} />
    </View>
  );
}

// The floating "liquid glass" close button, mirroring the round screen's X.
function CloseButton({ top, onPress }: { top: number; onPress: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Close the tour"
      style={[styles.closeButton, { top }]}>
      {({ pressed }) => (
        <>
          <GlassSurface borderRadius={18} />
          {pressed && <View style={styles.closePressed} pointerEvents="none" />}
          <IconSymbol name="xmark" size={18} color={colors.textPrimary} />
        </>
      )}
    </Pressable>
  );
}

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

// A standard deep-dive page: kicker + title + an illustrative visual + body, with
// a "Next" CTA pinned at the bottom. The visual is `pointerEvents="none"` so the
// interactive-looking surfaces don't capture taps during the tour. `visualFill`
// stretches the visual full-width (for the review card) instead of centering it.
function DeepDivePage({
  width,
  height,
  revealed,
  kicker,
  title,
  body,
  visual,
  visualFill,
  belowVisual,
  onContinue,
}: {
  width: number;
  height: number;
  revealed: boolean;
  kicker: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  visualFill?: boolean;
  /** Full-width content rendered under the visual (e.g. a sample bar graph). */
  belowVisual?: React.ReactNode;
  onContinue: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageScroll}>
          <Reveal revealed={revealed} order={0}>
            <ThemedText type="caption" style={styles.kicker}>
              {kicker}
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.title}>{title}</ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={2}>
            <ThemedText type="muted" style={styles.body}>
              {body}
            </ThemedText>
          </Reveal>
          <Reveal
            revealed={revealed}
            order={3}
            style={visualFill ? styles.visualFill : styles.visualWrap}>
            <View pointerEvents="none" style={visualFill ? styles.flexWidth : undefined}>
              {visual}
            </View>
          </Reveal>
          {belowVisual ? (
            <Reveal revealed={revealed} order={4} style={styles.belowVisual}>
              {belowVisual}
            </Reveal>
          ) : null}
        </Animated.ScrollView>
        <PrimaryButton label="Next" onPress={onContinue} />
      </View>
    </View>
  );
}

// ── Pages ───────────────────────────────────────────────────────────────────

// Page 1 — the payoff. The real ProgressView (ProgressViewBase), fed the sample
// season, so the tour opens on the exact screen the player is working toward.
function ExampleSeasonPage({
  width,
  height,
  season,
  onContinue,
}: {
  width: number;
  height: number;
  season: SampleSeason;
  onContinue: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const header = (
    <View style={styles.welcomeHeader}>
      <ThemedText type="caption" style={styles.kicker}>
        THE TOUR
      </ThemedText>
      <ThemedText style={styles.welcomeTitle}>Welcome to Caddie Book</ThemedText>
      <ThemedText type="muted" style={styles.body}>
        Here’s sample data of what you’ll get from Caddie Book — scroll to explore the stats
        you’ll build.
      </ThemedText>
      <View style={styles.swipeCue}>
        <ThemedText type="caption" style={styles.swipeText}>
          SWIPE TO EXPLORE
        </ThemedText>
        <IconSymbol name="chevron.right" size={14} color={colors.textMuted} />
      </View>
    </View>
  );

  return (
    <View style={{ width, height }}>
      <View style={styles.flex}>
        <ProgressViewBase header={header} bundle={season.bundle} bottomInset={spacing.lg} />
      </View>
      <View style={styles.exampleFooter}>
        <PrimaryButton label="Next" onPress={onContinue} />
      </View>
    </View>
  );
}

// Page 2 — course management. A representative set of pre-round intentions,
// shown on a read-only card mirroring the round summary's goals block.
const SAMPLE_GOALS: PreRoundGoals = {
  id: 'sample-goals',
  roundId: 'sample',
  execution: 'Commit to a full pre-shot routine on every tee',
  strategic: 'Aim for the fat side of every green',
  mental: 'Reset and breathe after every bogey',
  createdAt: '',
};

function GoalsCard({ goals }: { goals: PreRoundGoals }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const rows = GOAL_CATEGORIES.map((c) => ({ label: c.label, value: goals[c.key] })).filter(
    (r): r is { label: string; value: string } => !!r.value,
  );
  return (
    <SketchSurface seed="tour-goals" style={styles.cardSurface}>
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={[styles.goalRow, i < rows.length - 1 && styles.cardRowDivider]}>
          <ThemedText type="caption">{row.label.toUpperCase()}</ThemedText>
          <ThemedText style={styles.goalValue}>{row.value}</ThemedText>
        </View>
      ))}
    </SketchSurface>
  );
}

function CourseManagementPage({
  width,
  height,
  revealed,
  onContinue,
}: {
  width: number;
  height: number;
  revealed: boolean;
  onContinue: () => void;
}) {
  return (
    <DeepDivePage
      width={width}
      height={height}
      revealed={revealed}
      kicker="BEFORE THE ROUND · COURSE MANAGEMENT"
      title={'Play with a\nplan.'}
      body="Set three simple intentions before you tee off — how you’ll execute, how you’ll manage the course, and how you’ll stay level-headed. A clear plan turns good ball-striking into lower scores."
      onContinue={onContinue}
      visualFill
      visual={<GoalsCard goals={SAMPLE_GOALS} />}
    />
  );
}

// Page 3 — the journal. A couple of representative entries across tags, rendered
// on read-only cards mirroring the journal list.
type SampleJournalEntry = JournalEntry & { displayDate: string };
const SAMPLE_JOURNAL: SampleJournalEntry[] = [
  {
    id: 'tour-j1',
    tag: 'swing_thought',
    body: 'Slower transition — let the club fall before I turn through. Quiet hands.',
    createdAt: '',
    updatedAt: '',
    displayDate: 'Jun 12',
  },
  {
    id: 'tour-j2',
    tag: 'practice_session',
    body: '45 min wedges. 50/75/100 yd gaps dialed; still leaving the 60° short. Carry, not swing length.',
    createdAt: '',
    updatedAt: '',
    displayDate: 'Jun 9',
  },
];

function JournalCardList({ entries }: { entries: SampleJournalEntry[] }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.journalList}>
      {entries.map((entry) => (
        <SketchSurface key={entry.id} seed={`tour-${entry.id}`} style={styles.journalCard}>
          <View style={styles.journalCardTop}>
            <ThemedText type="caption">{journalTagLabel(entry.tag).toUpperCase()}</ThemedText>
            <ThemedText type="muted" style={styles.journalCardDate}>
              {entry.displayDate}
            </ThemedText>
          </View>
          <ThemedText style={styles.journalCardBody} numberOfLines={3}>
            {entry.body}
          </ThemedText>
        </SketchSurface>
      ))}
    </View>
  );
}

function JournalPage({
  width,
  height,
  revealed,
  onContinue,
}: {
  width: number;
  height: number;
  revealed: boolean;
  onContinue: () => void;
}) {
  return (
    <DeepDivePage
      width={width}
      height={height}
      revealed={revealed}
      kicker="OFF THE COURSE · JOURNAL"
      title={'Write it down,\nplay it back.'}
      body="Capture swing thoughts, practice notes, and round takeaways the moment they’re fresh. Tagged and dated, they become a record you can scroll back through to see what actually works for you."
      onContinue={onContinue}
      visualFill
      visual={<JournalCardList entries={SAMPLE_JOURNAL} />}
    />
  );
}

// Page 4 — the GPS rangefinder. Two cropped real screenshots, each in a rounded,
// hairline-framed surface, stacked: the measuring line first (distance to the
// pin), then the dispersion overlay (the shot history behind a number).
function ScreenshotFrame({ source }: { source: number }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <SketchSurface seed={`tour-shot-${source}`} radius={16} stroke={colors.border} style={styles.shotFrame}>
      <Image source={source} style={styles.shotImage} contentFit="cover" />
    </SketchSurface>
  );
}

function GpsRangefinderPage({
  width,
  height,
  revealed,
  onContinue,
}: {
  width: number;
  height: number;
  revealed: boolean;
  onContinue: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.pageScroll}>
          <Reveal revealed={revealed} order={0}>
            <ThemedText type="caption" style={styles.kicker}>
              ON THE COURSE · RANGEFINDER
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.title}>{'Know your\nnumber.'}</ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={2}>
            <ThemedText type="muted" style={styles.body}>
              Tap the satellite map for exact yardage to any target. Switch on dispersion to see
              every shot you’ve hit from that distance.
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={3} style={styles.shotStack}>
            <ScreenshotFrame source={RANGEFINDER_MEASURE} />
            <ScreenshotFrame source={RANGEFINDER_DISPERSION} />
          </Reveal>
        </Animated.ScrollView>
        <PrimaryButton label="Next" onPress={onContinue} />
      </View>
    </View>
  );
}

function ReviewDeepDivePage({
  width,
  height,
  revealed,
  season,
  onContinue,
}: {
  width: number;
  height: number;
  revealed: boolean;
  season: SampleSeason;
  onContinue: () => void;
}) {
  const review = useMemo(
    () => aggregateReview(season.bundle.rounds, season.reviewsByRound),
    [season],
  );
  return (
    <DeepDivePage
      width={width}
      height={height}
      revealed={revealed}
      kicker="A CLOSER LOOK · THE MENTAL GAME"
      title={'Reflect, then\nimprove.'}
      body="A quick five-tap review after each round adds up to patterns: what costs you the most strokes, your common miss, and what to take to the range."
      onContinue={onContinue}
      visualFill
      visual={<MentalGameCard review={review} empty={false} />}
    />
  );
}

// The dedicated App Store review ask. Tapping "Review Caddie Book" fires the
// native rating sheet; since the OS gives no submit callback, the primary CTA
// then flips to "Next" so the player can move on after rating (or right away).
function RatingPage({
  width,
  height,
  revealed,
  onContinue,
}: {
  width: number;
  height: number;
  revealed: boolean;
  onContinue: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [requested, setRequested] = useState(false);

  const onReview = () => {
    setRequested(true);
    void requestStoreReview();
  };

  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.pageScroll, styles.finishScroll]}>
          <Reveal revealed={revealed} order={0}>
            <ThemedText type="caption" style={styles.kicker}>
              ENJOYING CADDIE BOOK?
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.title}>{'Mind leaving\na review?'}</ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={2}>
            <ThemedText type="muted" style={styles.body}>
              Caddie Book is built by a small team. A quick rating genuinely helps other
              golfers find it — and tells us what to build next.
            </ThemedText>
          </Reveal>

          {/* A placeholder standing in for where the App Store rating sheet appears. */}
          <Reveal revealed={revealed} order={3} style={styles.ratingMockWrap}>
            <SketchSurface seed="tour-rating-mock" radius={16} stroke={colors.border} style={styles.ratingMock}>
              <ThemedText style={styles.ratingMockTitle}>Rate Caddie Book</ThemedText>
              <ThemedText type="muted" style={styles.ratingMockSub}>
                Tap a star to rate this app
              </ThemedText>
              <View style={styles.ratingStars}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      lightTap();
                      onReview();
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${i + 1} star${i === 0 ? '' : 's'}`}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <IconSymbol name="star.fill" size={28} color={colors.accent} />
                  </Pressable>
                ))}
              </View>
            </SketchSurface>
          </Reveal>
        </Animated.ScrollView>

        <View style={styles.finishButtons}>
          <PrimaryButton
            label={requested ? 'Next' : 'Review Caddie Book'}
            onPress={requested ? onContinue : onReview}
          />
          {!requested ? (
            <Pressable
              onPress={() => {
                lightTap();
                onContinue();
              }}
              accessibilityRole="button"
              accessibilityLabel="Maybe later"
              style={({ pressed }) => [styles.secondaryWrap, pressed && styles.pressed]}>
              <ThemedText style={styles.secondaryLabel}>Maybe later</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function FinishPage({
  width,
  height,
  revealed,
  onSetupBag,
  onAllDone,
}: {
  width: number;
  height: number;
  revealed: boolean;
  onSetupBag: () => void;
  onAllDone: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.pageScroll, styles.finishScroll]}>
          <Reveal revealed={revealed} order={0}>
            <ThemedText type="caption" style={styles.kicker}>
              YOU’RE READY
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.title}>{'Start your own\nseason.'}</ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={2}>
            <ThemedText type="muted" style={styles.body}>
              Next, set up your bag and stock yardages to make club tracking and the approach map smarter from round one.
            </ThemedText>
          </Reveal>
        </Animated.ScrollView>

        <View style={styles.finishButtons}>
          <PrimaryButton label="Set up my bag & yardages" onPress={onSetupBag} />
          <Pressable
            onPress={() => {
              lightTap();
              onAllDone();
            }}
            accessibilityRole="button"
            accessibilityLabel="All done"
            style={({ pressed }) => [styles.secondaryWrap, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryLabel}>All done</ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ── Small bits ────────────────────────────────────────────────────────────────

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable
      onPress={() => {
        lightTap();
        onPress();
      }}
      style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}>
      <SketchSurface
        seed={`tour-cta-${label}`}
        fill={colors.accent}
        stroke={colors.accent}
        radius={10}
        style={styles.cta}>
        <ThemedText style={styles.ctaLabel}>{label}</ThemedText>
      </SketchSurface>
    </Pressable>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    flex: { flex: 1 },
    flexWidth: { width: '100%' },
    pressed: { opacity: 0.6 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    topSide: { width: 56, justifyContent: 'center' },
    topSideRight: { alignItems: 'flex-end' },
    dots: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    dotActive: { width: 18, borderRadius: 3 },
    closeButton: {
      position: 'absolute',
      right: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 30,
    },
    closePressed: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.accentMuted,
    },
    page: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    pageScroll: {
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    finishScroll: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    kicker: {
      fontWeight: '500',
      letterSpacing: 2,
      color: colors.textMuted,
    },
    title: {
      fontFamily: fonts.serifBold,
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.4,
      color: colors.textPrimary,
    },
    body: {
      fontSize: 17,
      lineHeight: 26,
      marginTop: spacing.xs,
    },
    visualWrap: {
      alignItems: 'center',
      marginVertical: spacing.md,
    },
    visualFill: {
      marginVertical: spacing.md,
    },
    belowVisual: {
      width: '100%',
      marginTop: spacing.sm,
    },
    // Goals card (course-management page) — mirrors summary's RoundGoals.
    cardSurface: {
      paddingHorizontal: spacing.xs,
    },
    cardRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    goalRow: {
      gap: 4,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    goalValue: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    // Journal cards — mirror the journal list cards.
    journalList: {
      width: '100%',
      gap: spacing.md,
    },
    journalCard: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    journalCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    journalCardDate: {
      fontSize: 12,
    },
    journalCardBody: {
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    // Rangefinder screenshots — rounded, hairline-framed, stacked.
    shotStack: {
      width: '100%',
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.md,
    },
    shotFrame: {
      flex: 1,
      overflow: 'hidden',
      borderRadius: 16,
      padding: 0,
    },
    shotImage: {
      width: '100%',
      aspectRatio: SCREENSHOT_ASPECT,
    },
    // Example-season page: pinned Next button below the embedded progress view.
    exampleFooter: {
      paddingHorizontal: spacing.lg,
    },
    // Welcome header (rendered inside the ProgressView scroll on page 1)
    welcomeHeader: {
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    welcomeTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 30,
      lineHeight: 36,
      letterSpacing: -0.5,
      color: colors.textPrimary,
    },
    swipeCue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.xs,
    },
    swipeText: {
      letterSpacing: 2,
      color: colors.textMuted,
    },
    // Rating page mock (stands in for the OS rating sheet)
    ratingMockWrap: {
      marginTop: spacing.lg,
    },
    ratingMock: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.xs,
    },
    ratingMockTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    ratingMockSub: {
      fontSize: 13,
      lineHeight: 18,
    },
    ratingStars: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    // Finish page
    finishButtons: {
      gap: spacing.xs,
    },
    secondaryWrap: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      color: colors.textSecondary,
    },
    // CTA
    ctaWrap: { minHeight: 52, marginTop: spacing.md },
    ctaPressed: { transform: [{ scale: 0.97 }] },
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
  });
