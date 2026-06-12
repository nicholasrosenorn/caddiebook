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
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { AuthButtons } from '@/components/auth-buttons';
import { FirstRunTheme } from '@/components/first-run-theme';
import { Screen } from '@/components/screen';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { revealUp } from '@/lib/motion';

// ── Quiz model ──────────────────────────────────────────────────────────────
// A pure-conversion flow: the taps are an investment ladder, and every question
// carries a tip pairing a real golf insight with a real Caddie Book feature so
// the "tracking makes you better" thesis lands while you answer. Nothing is
// persisted — answers live in local state only, long enough to power the payoff.

type Qid = 'motivation' | 'handicap' | 'frequency' | 'improve' | 'review';

type Question = {
  id: Qid;
  title: string;
  multi?: boolean;
  options: string[];
  tip: { insight: string; feature: string };
};

const AREAS = ['Driving', 'Iron play', 'Short game', 'Putting'];

const QUESTIONS: Question[] = [
  {
    id: 'motivation',
    title: 'What brings you to\nCaddie Book?',
    options: ['Compete', 'Improve my game', 'Log my rounds', 'Play more social'],
    tip: {
      insight: 'Golfers who track their game improve up to 2× faster than those who only keep score.',
      feature:
        'Caddie Book turns every round into trends, dispersion maps, and a real handicap — so progress is something you can see.',
    },
  },
  {
    id: 'handicap',
    title: "What's your\nhandicap?",
    options: ['Scratch (0)', 'Low (1–9)', 'Mid (10–18)', 'High (19+)', "I don't have one yet"],
    tip: {
      insight: 'Keeping a handicap creates a more accurate picture of your game and helps identify what to work on.',
      feature:
        'Caddie Book calculates your handicap for you and visualizes your progress as you lower your scores.',
    },
  },
  {
    id: 'frequency',
    title: 'How often do\nyou play?',
    options: [
      'Multiple times a week',
      'Weekly',
      'A few times a month',
      'A few times a year',
      'Just getting started',
    ],
    tip: {
      insight: 'Around 24 rounds a year is where trends begin to guide improvement.',
      feature:
        'Caddie Book starts plotting trends at just 2 rounds and the picture gets clearer with every round.',
    },
  },
  {
    id: 'improve',
    title: 'What do you want\nto improve?',
    multi: true,
    options: AREAS,
    tip: {
      insight: 'Roughly 70% of your shots happen inside 100 yards.',
      feature:
        'Caddie Book breaks down your stats by area of the game, so you can see where to focus and track your improvement over time.',
    },
  },
  {
    id: 'review',
    title: 'Do you review your\nrounds afterward?',
    options: ['Every round', 'Sometimes', 'Not yet'],
    tip: {
      insight: 'Golfers who set goals and review their rounds improve up to 3× faster than those who don\'t',
      feature:
        'Caddie Book prioritizes the mental game aspects of your performance, highlighting your most-costly club, common miss, and decision making scoring.',
    },
  },
];

const TOTAL_PAGES = QUESTIONS.length + 1; // questions + payoff

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
 * A horizontal stepper: progress dots + a Continue CTA carry navigation; each
 * question reveals a contextual tip on selection; the final page reflects the
 * answers back and hands off via onDone.
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
              {QUESTIONS.map((q, i) => (
                <QuestionPage
                  key={q.id}
                  question={q}
                  width={width}
                  height={pageHeight}
                  revealed={revealed[i]}
                  selected={answers[q.id] ?? []}
                  onSelect={(opt) => select(q, opt)}
                  onContinue={() => scrollToStep(i + 1)}
                />
              ))}
              <PayoffPage
                width={width}
                height={pageHeight}
                revealed={revealed[TOTAL_PAGES - 1]}
                answers={answers}
              />
            </Animated.ScrollView>
          )}
        </View>
      </View>
    </Screen>
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
  const answered = selected.length > 0;

  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.pageScroll}
          keyboardShouldPersistTaps="handled">
          <Reveal revealed={revealed} order={0}>
            <ThemedText style={styles.title}>{question.title}</ThemedText>
          </Reveal>

          <Reveal revealed={revealed} order={1} style={styles.options}>
            {question.options.map((option) => (
              <OptionPill
                key={option}
                seed={`${question.id}-${option}`}
                label={option}
                selected={selected.includes(option)}
                onPress={() => onSelect(option)}
              />
            ))}
          </Reveal>

          {answered && (
            <Reveal revealed order={0} style={styles.tipWrap}>
              <TipCard id={question.id} tip={question.tip} />
            </Reveal>
          )}
        </Animated.ScrollView>

        <PrimaryButton label="Continue" onPress={onContinue} />
      </View>
    </View>
  );
}

// A full-width answer pill in the project's selection grammar: filled pine +
// grain + check when active, paper + drawn outline otherwise.
function OptionPill({
  seed,
  label,
  selected,
  onPress,
}: {
  seed: string;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable
      onPress={onPress}
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
        {selected && <IconSymbol name="checkmark" size={18} color={colors.accent} />}
      </SketchSurface>
    </Pressable>
  );
}

// The two-part tip: a lightbulb + the golf insight, a hairline rule, then the
// muted "Caddie Book will…" feature line.
function TipCard({ id, tip }: { id: Qid; tip: { insight: string; feature: string } }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <SketchSurface
      seed={`tip-${id}`}
      radius={12}
      fill={colors.surfaceAlt}
      stroke={colors.border}
      style={styles.tip}>
      <View style={styles.tipHead}>
        <IconSymbol name="lightbulb.fill" size={18} color={colors.accent} style={styles.tipIcon} />
        <ThemedText style={styles.tipInsight}>{tip.insight}</ThemedText>
      </View>
      <SketchDivider seed={`tip-rule-${id}`} />
      <ThemedText type="muted" style={styles.tipFeature}>
        {tip.feature}
      </ThemedText>
    </SketchSurface>
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

const FREQUENCY_SHORT: Record<string, string> = {
  'Multiple times a week': 'Plays most days',
  Weekly: 'Plays weekly',
  'A few times a month': 'Plays monthly',
  'A few times a year': 'Plays now and then',
  'Just getting started': 'Just getting started',
};

const IMPROVE_SUB: Record<string, string> = {
  Driving: 'Your dispersion map shows where the ball really goes off the tee.',
  'Iron play': 'Proximity and greens in regulation sharpen round over round.',
  'Short game': 'Your up-and-down rate tells you what’s actually working.',
  Putting: 'Make% by distance pinpoints where the strokes are hiding.',
};

type PlanRow = { title: string; sub: string };

// Turn the answers into a concrete "here's what you get" plan. Each row is a
// promise tied to a real feature; the middle row personalizes to their focus,
// the last to their current routine.
function buildPlan(answers: Answers): PlanRow[] {
  const handicap = answers.handicap?.[0];
  const improve = answers.improve?.[0];
  const reviews = answers.review?.[0] === 'Every round';

  const handicapRow: PlanRow =
    handicap === "I don't have one yet"
      ? {
          title: 'Get a real handicap',
          sub: 'Caddie Book builds your index from your very first round — no club needed.',
        }
      : {
          title: 'Track a real handicap',
          sub: 'A WHS-style index, updated automatically after every round you log.',
        };

  const focusRow: PlanRow = improve
    ? { title: `Sharpen your ${improve.toLowerCase()}`, sub: IMPROVE_SUB[improve] ?? IMPROVE_SUB.Putting }
    : {
        title: 'See your game clearly',
        sub: 'Scoring, greens, and putting trends that show exactly what to work on.',
      };

  const routineRow: PlanRow =
    reviews
      ? {
          title: 'Keep the loop going',
          sub: 'Your pre-round goals and post-round reviews, captured every time.',
        }
      : {
          title: 'Set goals, then reflect',
          sub: 'Three intentions before, a quick review after — the loop that compounds.',
        };

  return [handicapRow, focusRow, routineRow];
}

function PayoffPage({
  width,
  height,
  revealed,
  answers,
}: {
  width: number;
  height: number;
  revealed: boolean;
  answers: Answers;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const handicap = answers.handicap?.[0];
  const frequency = answers.frequency?.[0];
  const kickerParts = [
    handicap ? HANDICAP_SHORT[handicap] : null,
    frequency ? FREQUENCY_SHORT[frequency] : null,
  ].filter((p): p is string => Boolean(p));
  const kicker = kickerParts.length > 0 ? kickerParts.join(' · ') : 'Your game plan';
  const plan = buildPlan(answers);

  return (
    <View style={{ width, height }}>
      <View style={styles.page}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.pageScroll, styles.payoffScroll]}>
          <Reveal revealed={revealed} order={0}>
            <ThemedText type="caption" style={styles.kicker}>
              {kicker.toUpperCase()}
            </ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={1}>
            <ThemedText style={styles.title}>Here’s your{'\n'}game plan.</ThemedText>
          </Reveal>
          <Reveal revealed={revealed} order={2}>
            <ThemedText type="muted" style={styles.subtitle}>
              Three things Caddie Book starts doing the moment you log your first round.
            </ThemedText>
          </Reveal>

          <View style={styles.plan}>
            {plan.map((row, i) => (
              <Reveal key={row.title} revealed={revealed} order={3 + i}>
                {i > 0 && <SketchDivider seed={`payoff-rule-${i}`} />}
                <View style={styles.planRow}>
                  <ThemedText style={styles.planNum}>{`0${i + 1}`}</ThemedText>
                  <View style={styles.planText}>
                    <ThemedText style={styles.planTitle}>{row.title}</ThemedText>
                    <ThemedText type="muted" style={styles.planSub}>
                      {row.sub}
                    </ThemedText>
                  </View>
                </View>
              </Reveal>
            ))}
          </View>
        </Animated.ScrollView>

        <Reveal revealed={revealed} order={6} style={styles.payoffAuth}>
          <AuthButtons />
        </Reveal>
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
    payoffScroll: {
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
    subtitle: {
      fontSize: 16,
      lineHeight: 24,
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
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      minHeight: 48,
    },
    pillLabel: {
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 15,
      lineHeight: 21,
      color: colors.textPrimary,
    },
    pillLabelSelected: {
      color: colors.accent,
    },
    // Tip card
    tipWrap: {
      marginTop: spacing.sm,
    },
    tip: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    tipHead: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tipIcon: {
      marginTop: 2,
    },
    tipInsight: {
      flex: 1,
      fontFamily: fonts.serifBold,
      fontSize: 16,
      lineHeight: 23,
      color: colors.textPrimary,
    },
    tipFeature: {
      fontSize: 15,
      lineHeight: 22,
    },
    // Payoff plan
    plan: {
      marginTop: spacing.lg,
      gap: spacing.md,
    },
    planRow: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    planNum: {
      fontFamily: fonts.serifBold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.accent,
      width: 28,
    },
    planText: {
      flex: 1,
      gap: 2,
    },
    planTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 19,
      lineHeight: 25,
      color: colors.textPrimary,
    },
    planSub: {
      fontSize: 15,
      lineHeight: 22,
    },
    payoffAuth: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    payoffPrompt: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
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
