import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { FirstRunTheme } from '@/components/first-run-theme';
import { Screen } from '@/components/screen';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { revealUp } from '@/lib/motion';

// ── Quiz model ──────────────────────────────────────────────────────────────
// A short, goal-oriented flow: each question profiles a facet of the player's
// game so the payoff can fit a personalized improvement plan to their answers.
// Nothing is persisted — answers live in local state only, long enough to power
// the payoff.

type Qid = 'handicap' | 'improve' | 'commonMiss' | 'troubleClubs' | 'puttingFocus' | 'review';

type Question = {
  id: Qid;
  title: string;
  multi?: boolean;
  options: string[];
};

const AREAS = ['Driving', 'Iron play', 'Short game', 'Putting'];

const QUESTIONS: Question[] = [
  {
    id: 'handicap',
    title: "What's your\nhandicap?",
    options: ['Scratch (0)', 'Low (1–9)', 'Mid (10–18)', 'High (19+)', "I don't have one yet"],
  },
  {
    id: 'improve',
    title: 'What do you want\nto improve?',
    multi: true,
    options: AREAS,
  },
  {
    id: 'commonMiss',
    title: "What's your\ncommon miss?",
    options: ['Slice / push right', 'Hook / pull left', 'Thin or topped', 'Fat / chunked', 'Pretty straight'],
  },
  {
    id: 'troubleClubs',
    title: 'Which clubs cost\nyou the most?',
    multi: true,
    options: ['Driver', 'Long irons', 'Mid irons', 'Wedges', 'Putter'],
  },
  {
    id: 'puttingFocus',
    title: 'Where do you want to\nsharpen your putting?',
    options: ['Lag putts (20 ft+)', 'Mid-range (5–15 ft)', 'Short putts (under 5 ft)', 'Reading greens'],
  },
  {
    id: 'review',
    title: 'Do you review your\nrounds afterward?',
    options: ['Every round', 'Sometimes', 'Not yet'],
  },
];

const TOTAL_PAGES = QUESTIONS.length + 2; // intro + questions + payoff

// The "calculating your plan" beat: how long the overlay holds, and how long
// the ball takes to roll the fairway (it sinks into the cup just before the
// overlay lifts to reveal the payoff).
const CALC_DURATION_MS = 2600;
const ROLL_MS = CALC_DURATION_MS - 500;

type Answers = Partial<Record<Qid, string[]>>;

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
 * The first-run personalization quiz, shown between the intro and sign-in.
 * Pinned to the Augusta editorial theme via FirstRunTheme, matching the intro.
 * A horizontal stepper: an intro promise, a set of goal-oriented questions, a
 * brief "calculating your plan" beat, then a payoff that fits numeric goals +
 * a projected index change to the answers and hands off via onDone.
 */
export function Personalize({ onDone, onExit }: { onDone: () => void; onExit: () => void }) {
  return (
    <FirstRunTheme>
      <PersonalizeFlow onDone={onDone} onExit={onExit} />
    </FirstRunTheme>
  );
}

function PersonalizeFlow({ onDone, onExit }: { onDone: () => void; onExit: () => void }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  // A brief "calculating your plan" beat between the last question and the
  // payoff. The payoff is scrolled into place underneath and only reveals once
  // this clears, so its count-up + stagger fire as the overlay lifts.
  const [calculating, setCalculating] = useState(false);
  useEffect(() => {
    if (!calculating) return;
    const t = setTimeout(() => setCalculating(false), CALC_DURATION_MS);
    return () => clearTimeout(t);
  }, [calculating]);
  // Reveal-once flags per page; the first page choreographs on mount.
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

  // Last question → run the calculating beat, then land on the payoff.
  const goToPayoff = useCallback(() => {
    setCalculating(true);
    scrollToStep(TOTAL_PAGES - 1);
  }, [scrollToStep]);

  const select = useCallback((q: Question, option: string) => {
    lightTap();
    setAnswers((prev) => {
      const current = prev[q.id] ?? [];
      if (q.multi) {
        const next = current.includes(option)
          ? current.filter((o) => o !== option)
          : [...current, option];
        return { ...prev, [q.id]: next };
      }
      return { ...prev, [q.id]: [option] };
    });
  }, []);

  return (
    <Screen padded={false} paper={false}>
      <View style={[styles.flex, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <TopBar
          step={step}
          // Back from the first question exits to the intro; otherwise step back.
          onBack={() => (step > 0 ? scrollToStep(step - 1) : onExit())}
          onSkip={onDone}
        />

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
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled">
              <IntroPage
                width={width}
                height={pageHeight}
                revealed={revealed[0]}
                onContinue={() => scrollToStep(1)}
              />
              {/* Intro is page 0, so question j lives on page j + 1. */}
              {QUESTIONS.map((q, i) => (
                <QuestionPage
                  key={q.id}
                  question={q}
                  width={width}
                  height={pageHeight}
                  revealed={revealed[i + 1]}
                  selected={answers[q.id] ?? []}
                  onSelect={(opt) => select(q, opt)}
                  onContinue={() =>
                    i === QUESTIONS.length - 1 ? goToPayoff() : scrollToStep(i + 2)
                  }
                />
              ))}
              <PayoffPage
                width={width}
                height={pageHeight}
                revealed={revealed[TOTAL_PAGES - 1] && !calculating}
                answers={answers}
                onStart={onDone}
              />
            </Animated.ScrollView>
          )}
          {calculating && <CalculatingOverlay />}
        </View>
      </View>
    </Screen>
  );
}

// The "building your plan" beat shown over the payoff while it settles in.
// Sells the personalization — answers fitted to historical player data.
function CalculatingOverlay() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(400)}
      style={styles.calcOverlay}
      pointerEvents="auto">
      <PuttLoader />
      <ThemedText style={styles.calcText}>
        Calculating your goals from data across thousands of Caddie Book players…
      </ThemedText>
    </Animated.View>
  );
}

// A golf-themed progress bar: a ball rolls along the fairway track and drops
// into the cup beside the flag as the bar fills. The fill (ink) is the ball's
// trail, so the bar and the roll are one motion. Plays once, timed to clear
// just before the overlay lifts.
function PuttLoader() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [trackW, setTrackW] = useState(0);
  const progress = useSharedValue(0);
  const sink = useSharedValue(0);

  useEffect(() => {
    if (trackW <= 0) return;
    progress.value = 0;
    sink.value = 0;
    progress.value = withTiming(1, { duration: ROLL_MS, easing: Easing.inOut(Easing.cubic) });
    // The drop into the cup, just after the roll reaches the flag.
    sink.value = withDelay(ROLL_MS, withTiming(1, { duration: 260, easing: Easing.in(Easing.quad) }));
  }, [trackW, progress, sink]);

  // The filled trail grows to the full track width.
  const fillStyle = useAnimatedStyle(() => ({ width: progress.value * trackW }));
  // The ball rides the trail's leading edge, rolls (spin), then drops + fades.
  const ballStyle = useAnimatedStyle(() => ({
    opacity: 1 - sink.value,
    transform: [
      { translateY: sink.value * 9 },
      { scale: 1 - sink.value * 0.55 },
      { rotate: `${progress.value * 540}deg` },
    ],
  }));

  return (
    <View style={styles.loaderWrap}>
      <View
        style={styles.track}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        {/* The cup the ball drops into, at the end of the fairway. */}
        <View style={styles.cup} pointerEvents="none" />
        <Animated.View style={[styles.fill, fillStyle]}>
          <Animated.View style={[styles.ball, ballStyle]}>
            <View style={styles.ballDimple} />
          </Animated.View>
        </Animated.View>
        {/* The flagstick planted at the cup. */}
        <View style={styles.flag} pointerEvents="none">
          <View style={styles.flagPole} />
          <View style={styles.flagPennant} />
        </View>
      </View>
    </View>
  );
}

// The top chrome: a back chevron (from page 1 on), centered progress dots, and
// a persistent Skip. Mirrors the intro's Skip styling.
function TopBar({
  step,
  onBack,
  onSkip,
}: {
  step: number;
  onBack: () => void;
  onSkip: () => void;
}) {
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
            accessibilityLabel="Previous question"
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

      <View style={[styles.topSide, styles.topSideRight]}>
        <Pressable
          onPress={onSkip}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="label" style={styles.skipLabel}>
            Skip
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// A reveal-once block (same pattern as the intro): invisible until its page is
// first focused, then it fades up in stagger order.
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

// The opening screen: sets the promise that the next few questions become a
// concrete, personalized improvement plan. Same page frame + reveal stagger as
// the questions, with a single CTA into the flow.
function IntroPage({
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
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.pageScroll, styles.introScroll]}>
          <Reveal revealed={revealed} order={0}>
            <ThemedText type="caption" style={styles.kicker}>
              YOUR IMPROVEMENT PLAN
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.title}>Let’s build a plan{'\n'}made for you.</ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={2}>
            <ThemedText type="muted" style={styles.introBody}>
              Answer a few quick questions about your game. We’ll fit your answers to
              historical data from thousands of Caddie Book players to build a set of clear,
              numeric goals — and the handicap drop that comes with hitting them.
            </ThemedText>
          </Reveal>
        </Animated.ScrollView>

        <PrimaryButton label="Get started" onPress={onContinue} />
      </View>
    </View>
  );
}

function QuestionPage({
  question,
  width,
  height,
  revealed,
  selected,
  onSelect,
  onContinue,
}: {
  question: Question;
  width: number;
  height: number;
  revealed: boolean;
  selected: string[];
  onSelect: (option: string) => void;
  onContinue: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pageScroll}
          keyboardShouldPersistTaps="handled">
          <Reveal revealed={revealed} order={0}>
            <ThemedText style={styles.title}>{question.title}</ThemedText>
            <ThemedText type="muted" style={styles.multiHint}>
              {question.multi ? 'Select all that apply' : 'Choose one'}
            </ThemedText>
          </Reveal>

          <Reveal revealed={revealed} order={1} style={styles.options}>
            {question.options.map((option) => (
              <OptionPill
                key={option}
                seed={`${question.id}-${option}`}
                label={option}
                selected={selected.includes(option)}
                multi={Boolean(question.multi)}
                onPress={() => onSelect(option)}
              />
            ))}
          </Reveal>
        </Animated.ScrollView>

        <PrimaryButton label="Continue" onPress={onContinue} />
      </View>
    </View>
  );
}

// A full-width answer row in the project's selection grammar: a tinted fill +
// drawn accent outline when active, paper + hairline otherwise. A trailing
// indicator — a circle (choose one) or square (multi) that fills with a check —
// makes the selection state unmistakable.
function OptionPill({
  seed,
  label,
  selected,
  multi,
  onPress,
}: {
  seed: string;
  label: string;
  selected: boolean;
  multi: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.pillWrap, pressed && styles.pillPressed]}>
      <SketchSurface
        seed={`opt-${seed}`}
        radius={14}
        fill={selected ? colors.accentMuted : colors.surface}
        stroke={selected ? colors.accent : colors.borderStrong}
        style={styles.pill}>
        <ThemedText style={[styles.pillLabel, selected && styles.pillLabelSelected]}>
          {label}
        </ThemedText>
        <View
          style={[
            styles.optIndicator,
            multi ? styles.optIndicatorSquare : styles.optIndicatorCircle,
            selected && styles.optIndicatorOn,
          ]}>
          {selected && <IconSymbol name="checkmark" size={14} color={colors.accentOn} />}
        </View>
      </SketchSurface>
    </Pressable>
  );
}

// ── Payoff ────────────────────────────────────────────────────────────────
const HANDICAP_SHORT: Record<string, string> = {
  'Scratch (0)': 'Scratch golfer',
  'Low (1–9)': 'Low handicap',
  'Mid (10–18)': 'Mid handicap',
  'High (19+)': 'High handicap',
  "I don't have one yet": 'New to handicaps',
};

// ── The personalized "first card" ────────────────────────────────────────────
// A representative index per band; null = no index yet (round-one framing).
const HANDICAP_INDEX: Record<string, number | null> = {
  'Scratch (0)': 0.0,
  'Low (1–9)': 5.2,
  'Mid (10–18)': 14.0,
  'High (19+)': 22.5,
  "I don't have one yet": null,
};

// ── Goals ─────────────────────────────────────────────────────────────────
// Three numeric goals derived from the quiz: `improve` picks which metrics, the
// `handicap` band calibrates each target. Every value mirrors a figure shown on
// the Stats screen (progress-view.tsx) in the same units — so a goal here is a
// number the golfer will literally watch move after their first round. Purely
// presentational; nothing is persisted.
type GoalMetric = 'fir' | 'gir' | 'ud' | 'putts';

// improve answer → metric (mirrors the four "numbers" tiles on the Stats view).
const AREA_METRIC: Record<string, GoalMetric> = {
  Driving: 'fir',
  'Iron play': 'gir',
  'Short game': 'ud',
  Putting: 'putts',
};

// Fill order when fewer than three areas are chosen — most universal first.
const GOAL_PRIORITY: GoalMetric[] = ['putts', 'fir', 'gir', 'ud'];

const GOAL_COPY: Record<GoalMetric, { label: string; blurb: string }> = {
  fir: { label: 'Fairways hit', blurb: 'Tracked on your drive map and FIR rate, every round.' },
  gir: { label: 'Greens hit', blurb: 'Your greens-in-regulation rate updates after each round.' },
  ud: { label: 'Up & downs', blurb: 'Your up-and-down rate shows what’s working around the green.' },
  putts: { label: 'Putts per hole', blurb: 'Putting by distance shows where the strokes hide.' },
};

// Calibrated target per handicap band, keyed by the question's option strings
// (same pattern as HANDICAP_INDEX). % metrics hold a whole number; putts a 2-dp
// number. Lower is better for putts; higher for the rest.
const GOAL_TARGETS: Record<GoalMetric, Record<string, number>> = {
  fir: { 'Scratch (0)': 65, 'Low (1–9)': 58, 'Mid (10–18)': 50, 'High (19+)': 42, "I don't have one yet": 40 },
  gir: { 'Scratch (0)': 67, 'Low (1–9)': 50, 'Mid (10–18)': 39, 'High (19+)': 25, "I don't have one yet": 22 },
  ud: { 'Scratch (0)': 60, 'Low (1–9)': 50, 'Mid (10–18)': 42, 'High (19+)': 33, "I don't have one yet": 30 },
  putts: { 'Scratch (0)': 1.72, 'Low (1–9)': 1.8, 'Mid (10–18)': 1.85, 'High (19+)': 1.92, "I don't have one yet": 1.94 },
};

const DEFAULT_BAND = 'Mid (10–18)';

// When a putts goal is present, sharpen its blurb to the area of the green the
// player flagged on the putting-focus question.
const PUTTING_FOCUS_BLURB: Record<string, string> = {
  'Lag putts (20 ft+)': 'Lag the long ones closer — your make % from distance shows it land.',
  'Mid-range (5–15 ft)': 'Convert more mid-range looks — make % by distance tracks the gain.',
  'Short putts (under 5 ft)': 'Bank the short ones — your make % inside 5 ft updates every round.',
  'Reading greens': 'Better reads, fewer misses — putting by distance shows the payoff.',
};

type Goal = { key: GoalMetric; label: string; value: string; blurb: string };

// Selected improve areas (in tap order) → metrics, deduped, padded from
// GOAL_PRIORITY, capped at three. Each target reads off the handicap band; a
// putts goal is further tailored by the putting-focus answer.
function buildGoals(answers: Answers): Goal[] {
  const band = answers.handicap?.[0] ?? DEFAULT_BAND;
  const puttingFocus = answers.puttingFocus?.[0];
  const chosen = (answers.improve ?? [])
    .map((area) => AREA_METRIC[area])
    .filter((m): m is GoalMetric => Boolean(m));
  const ordered: GoalMetric[] = [];
  for (const m of [...chosen, ...GOAL_PRIORITY]) {
    if (!ordered.includes(m)) ordered.push(m);
  }
  return ordered.slice(0, 3).map((key) => {
    const target = GOAL_TARGETS[key][band] ?? GOAL_TARGETS[key][DEFAULT_BAND];
    const value = key === 'putts' ? target.toFixed(2) : `${target}%`;
    const blurb =
      key === 'putts' && puttingFocus && PUTTING_FOCUS_BLURB[puttingFocus]
        ? PUTTING_FOCUS_BLURB[puttingFocus]
        : GOAL_COPY[key].blurb;
    return { key, label: GOAL_COPY[key].label, value, blurb };
  });
}

type Projection = { to: number; decimals: number; prefix: string; caption: string; sub: string };

// The hero number on the card, framed as a change you can act on (the projected
// index drop) rather than an abstract future index.
function buildProjection(answers: Answers): Projection {
  const band = answers.handicap?.[0];
  const index = band ? HANDICAP_INDEX[band] : undefined;
  if (index == null) {
    return {
      to: 1,
      decimals: 0,
      prefix: '',
      caption: 'ROUNDS TO YOUR FIRST INDEX',
      sub: 'Your handicap begins the moment you log round one.',
    };
  }
  if (index <= 0.5) {
    return {
      to: 0,
      decimals: 1,
      prefix: '',
      caption: 'ALREADY SCRATCH',
      sub: 'We keep your index honest and your edges sharp.',
    };
  }
  const drop = Math.round(index * 0.22 * 10) / 10; // ~22% off in a first season
  const short = (HANDICAP_SHORT[band ?? ''] ?? 'players').toLowerCase();
  return {
    to: drop,
    decimals: 1,
    prefix: '−',
    caption: 'PROJECTED INDEX CHANGE AFTER MEETING GOALS',
    sub: `Hit these targets over a season and a drop like this is well within reach for most ${short} players.`,
  };
}

// A number that counts up once, the first time `active` flips true. JS-thread
// (a short, one-time tween) — no reanimated text plumbing needed.
function CountUp({
  to,
  decimals,
  active,
  prefix = '',
  style,
  duration = 800,
}: {
  to: number;
  decimals: number;
  active: boolean;
  prefix?: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to, duration]);
  // A leading '−' reads as a drop — show it as a down chevron instead of a glyph.
  return (
    <View style={styles.payoffIndexRow}>
      {prefix === '−' && (
        <IconSymbol name="arrowtriangle.down.fill" size={30} color={colors.accent} style={styles.payoffIndexChevron} />
      )}
      <ThemedText style={[styles.payoffIndex, style]}>
        {prefix !== '−' && prefix}
        {value.toFixed(decimals)}
      </ThemedText>
    </View>
  );
}

// One numbered goal row: a target value (in the Stats screen's own units) beside
// the metric name + how Caddie Book tracks it.
function GoalRow({ index, goal }: { index: number; goal: Goal }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.goalRow}>
      <ThemedText style={styles.goalNum}>{`0${index + 1}`}</ThemedText>
      <View style={styles.goalText}>
        <ThemedText style={styles.goalLabel}>{goal.label}</ThemedText>
        <ThemedText type="muted" style={styles.goalBlurb}>
          {goal.blurb}
        </ThemedText>
      </View>
      <View style={styles.goalValueCol}>
        <ThemedText style={styles.goalValue}>{goal.value}</ThemedText>
        <ThemedText type="caption" style={styles.goalValueCaption}>
          TARGET
        </ThemedText>
      </View>
    </View>
  );
}

function PayoffPage({
  width,
  height,
  revealed,
  answers,
  onStart,
}: {
  width: number;
  height: number;
  revealed: boolean;
  answers: Answers;
  onStart: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const handicap = answers.handicap?.[0];
  const kicker = handicap ? HANDICAP_SHORT[handicap] : 'Your game plan';
  const projection = buildProjection(answers);
  const goals = buildGoals(answers);

  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pageScroll}>
          <Reveal revealed={revealed} order={0}>
            <ThemedText type="caption" style={styles.kicker}>
              {kicker.toUpperCase()}
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.title}>Here’s your{'\n'}game plan.</ThemedText>
          </Reveal>

          {/* Goals first — the concrete targets — then the index outcome. */}
          <View style={styles.plan}>
            {goals.map((goal, i) => (
              <Reveal key={goal.key} revealed={revealed} order={2 + i}>
                {i > 0 && <SketchDivider seed={`payoff-rule-${i}`} />}
                <GoalRow index={i} goal={goal} />
              </Reveal>
            ))}
          </View>

          <Reveal revealed={revealed} order={5} style={styles.payoffCardWrap}>
            <SketchSurface seed="payoff-card" radius={16} stroke={colors.border} style={styles.payoffCard}>
              <View style={styles.payoffProjection}>
                <CountUp
                  prefix={projection.prefix}
                  to={projection.to}
                  decimals={projection.decimals}
                  active={revealed}
                />
                <ThemedText type="caption" style={[styles.kicker, styles.payoffCaption]}>
                  {projection.caption}
                </ThemedText>
              </View>
              <ThemedText type="muted" style={styles.payoffSub}>
                {projection.sub}
              </ThemedText>
            </SketchSurface>
          </Reveal>

          {/* The account CTA → the dedicated sign-in screen (Apple/Google). */}
          <Reveal revealed={revealed} order={6}>
            <PrimaryButton label="Start tracking" onPress={onStart} />
          </Reveal>
        </Animated.ScrollView>
      </View>
    </View>
  );
}

// The flow's filled-pine CTA — a Continue on each question, the account CTA on
// the payoff. Press feedback is a physical scale-down + light haptic.
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
        seed={`personalize-cta-${label}`}
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
    pressed: { opacity: 0.6 },
    // Top chrome
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    topSide: {
      width: 56,
      justifyContent: 'center',
    },
    topSideRight: {
      alignItems: 'flex-end',
    },
    dots: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    dotActive: {
      width: 18,
      borderRadius: 3,
    },
    skipLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
    // Page frame
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
    multiHint: {
      marginTop: spacing.xs,
      fontSize: 14,
      lineHeight: 20,
    },
    introScroll: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    introBody: {
      fontSize: 17,
      lineHeight: 26,
      marginTop: spacing.sm,
    },
    // Calculating overlay
    calcOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.lg,
      backgroundColor: colors.background,
    },
    calcText: {
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 27,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    // Golf-ball progress bar
    loaderWrap: {
      width: '100%',
      paddingTop: 30, // headroom for the flag above the track
    },
    track: {
      width: '100%',
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.surfaceAlt,
      justifyContent: 'center',
    },
    cup: {
      position: 'absolute',
      right: -5,
      top: -1,
      width: 18,
      height: 8,
      borderRadius: 9,
      backgroundColor: colors.border,
    },
    fill: {
      height: '100%',
      borderRadius: 3,
      backgroundColor: colors.accent,
    },
    ball: {
      position: 'absolute',
      right: -8,
      top: -5,
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.accent,
      backgroundColor: colors.background,
    },
    ballDimple: {
      position: 'absolute',
      top: 3.5,
      left: 3.5,
      width: 3.5,
      height: 3.5,
      borderRadius: 2,
      backgroundColor: colors.borderStrong,
    },
    flag: {
      position: 'absolute',
      right: -3,
      bottom: 1,
      alignItems: 'flex-end',
    },
    flagPole: {
      width: 2,
      height: 26,
      borderRadius: 1,
      backgroundColor: colors.accent,
    },
    flagPennant: {
      position: 'absolute',
      top: 1,
      right: 2,
      width: 0,
      height: 0,
      borderTopWidth: 5,
      borderBottomWidth: 5,
      borderRightWidth: 10,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: colors.accent,
    },
    options: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    // Option pill
    pillWrap: {
      width: '100%',
    },
    pillPressed: {
      transform: [{ scale: 0.98 }],
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      minHeight: 56,
    },
    pillLabel: {
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    pillLabelSelected: {
      fontFamily: fonts.serifBold,
      color: colors.accent,
    },
    // Selection indicator (circle = choose one, square = multi)
    optIndicator: {
      width: 24,
      height: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      backgroundColor: 'transparent',
    },
    optIndicatorCircle: {
      borderRadius: 12,
    },
    optIndicatorSquare: {
      borderRadius: 7,
    },
    optIndicatorOn: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    // Payoff goals
    plan: {
      marginTop: spacing.lg,
      gap: spacing.md,
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    goalNum: {
      fontFamily: fonts.serifBold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.accent,
      width: 28,
    },
    goalText: {
      flex: 1,
      gap: 2,
    },
    goalLabel: {
      fontFamily: fonts.serifBold,
      fontSize: 19,
      lineHeight: 25,
      color: colors.textPrimary,
    },
    goalBlurb: {
      fontSize: 15,
      lineHeight: 22,
    },
    goalValueCol: {
      width: 72,
      alignItems: 'flex-end',
    },
    goalValue: {
      fontFamily: fonts.serifBold,
      fontSize: 26,
      lineHeight: 30,
      letterSpacing: -0.5,
      color: colors.accent,
    },
    goalValueCaption: {
      fontWeight: '500',
      letterSpacing: 1.5,
      color: colors.textMuted,
    },
    // Payoff card (the personalized "first card")
    payoffCardWrap: {
      marginTop: spacing.lg,
    },
    payoffCard: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    payoffProjection: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.md,
    },
    payoffIndexRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    payoffIndexChevron: {
      marginRight: 2,
    },
    payoffIndex: {
      fontFamily: fonts.serifBold,
      fontSize: 56,
      lineHeight: 62,
      letterSpacing: -1,
      color: colors.accent,
    },
    payoffCaption: {
      flex: 1,
    },
    payoffSub: {
      fontSize: 15,
      lineHeight: 22,
    },
    // CTA
    ctaWrap: {
      minHeight: 52,
      marginTop: spacing.md,
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
  });
