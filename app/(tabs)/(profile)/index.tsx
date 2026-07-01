import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type AnimatedRef,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ApproachTarget } from '@/components/approach-target';
import { Cascade } from '@/components/cascade';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { EdgeSwipeOpener } from '@/components/edge-swipe-opener';
import { FiguresRow } from '@/components/figures-row';
import { MeSummaryViewBase } from '@/components/me-summary-view';
import { Screen } from '@/components/screen';
import { SegmentedControl, type SegmentOption } from '@/components/segmented-control';
import { SetupCoachmark } from '@/components/setup-coachmark';
import { SketchDivider } from '@/components/sketch';
import {
  ScoreDistributionBars,
  Section,
  SplitDistanceBars,
  ValueBars,
} from '@/components/stats-figures';
import {
  BestRoundCallout,
  formatAvg,
  MentalGameCard,
  ScoringFigures,
  SectionHero,
} from '@/components/stats-sections';
import { ThemedText } from '@/components/themed-text';
import { TourNudge } from '@/components/tour-nudge';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { sortByClubOrder, sortByDriveLength } from '@/constants/clubs';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/provider';
import type { Hole, PostRoundReview, Putt, Round, Shot } from '@/lib/data/models';
import { useSetupTooltip } from '@/lib/data/settings';
import { useStatsBundle } from '@/lib/data/stats';
import {
  aggregateApproach,
  aggregateDriveDistance,
  aggregateDriver,
  aggregatePersonalBests,
  aggregateReview,
  aggregateStats,
  formatMissDirection,
  formatToPar,
  perRoundTrend,
  windowDelta,
  type ApproachStats,
  type DriveDistanceStats,
  type DriverStats,
  type HoleCountFilter,
  type LifetimeStats,
  type PersonalBests,
  type ReviewInsights,
  type RoundDerived,
  type RoundsFilter,
} from '@/lib/lifetime-stats';
import { formatPct } from '@/lib/stats';

type ClubFilter = 'all' | string;

// The Me tab is a single sectioned surface: the Overview (Me summary) plus deep
// sections in one vertical scroll. The identity masthead scrolls away; the section
// rail + filter pin. Tapping a rail item (or an Overview card) switches sections.
const SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'driving', label: 'Driving' },
  { key: 'approach', label: 'Approach' },
  { key: 'short', label: 'Short Game' },
  { key: 'mental', label: 'Mental' },
  { key: 'bests', label: 'Bests' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

// Filter options as string-valued segments (SegmentedControl is string-generic);
// the handlers map back to the numeric HoleCountFilter / RoundsFilter.
const HOLE_SEGMENTS: SegmentOption<string>[] = [
  { value: 'all', label: 'All' },
  { value: '18', label: '18' },
  { value: '9', label: '9' },
];

const ROUND_SEGMENTS: SegmentOption<string>[] = [
  { value: '20', label: '20' },
  { value: '40', label: '40' },
  { value: '60', label: '60' },
  { value: 'all', label: 'All' },
];

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k);
    if (arr) arr.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function distinctClubs(
  rounds: Round[],
  holesByRound: Map<string, Hole[]>,
  field: 'driveClub' | 'approachClub',
): string[] {
  const seen = new Set<string>();
  for (const r of rounds) {
    for (const h of holesByRound.get(r.id) ?? []) {
      const club = h[field];
      if (club) seen.add(club);
    }
  }
  return [...seen];
}

type StatsView = {
  stats: LifetimeStats;
  trend: RoundDerived[];
  review: ReviewInsights;
};

export default function ProfileScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const tabBarHeight = useBottomTabBarHeight();
  const { session } = useAuth();
  const user = session?.user;
  const tooltip = useSetupTooltip();

  const bundle = useStatsBundle().data ?? null;

  const [holeFilter, setHoleFilter] = useState<HoleCountFilter>(18);
  const [roundsFilter, setRoundsFilter] = useState<RoundsFilter>(20);
  const [clubFilter, setClubFilter] = useState<ClubFilter>('all');
  const [driveClubFilter, setDriveClubFilter] = useState<ClubFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);

  const [active, setActive] = useState(0);
  // Height of the identity masthead — the collapsible part of the header. The pinned
  // rail/filter measure into pinnedHeight; together they reserve the pages' paddingTop.
  const [identityHeight, setIdentityHeight] = useState(0);
  const [pinnedHeight, setPinnedHeight] = useState(0);
  // Viewport measured from the wrapper: each page is sized to it exactly so the inner
  // vertical scroll (not the row) does the scrolling and the row pages cleanly.
  const [pageWidth, setPageWidth] = useState<number | null>(null);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  // Deep-section pages mount lazily on first visit: keeps 7 heavy SVG pages from
  // mounting at once and lets each section's Cascade play when you first land on it.
  const [visited, setVisited] = useState<Set<number>>(() => new Set([0]));
  // Measured rail pill geometry, driving both auto-centering and the sliding underline.
  const [pillLayouts, setPillLayouts] = useState<{ x: number; width: number }[]>([]);
  const railRef = useRef<ScrollView>(null);

  // Horizontal pager + one vertical scroll per page (kept so we can sync their offsets
  // on page change), plus the shared values that drive the collapsing header.
  const pagerRef = useAnimatedRef<Animated.ScrollView>();
  const pageRefs = useRef<(AnimatedRef<Animated.ScrollView> | null)[]>(
    Array(SECTIONS.length).fill(null),
  );
  const registerPage = useCallback(
    (index: number, ref: AnimatedRef<Animated.ScrollView>) => {
      pageRefs.current[index] = ref;
    },
    [],
  );
  const scrollY = useSharedValue(0); // active page's vertical offset → header collapse
  const activeIndex = useSharedValue(0); // current page, on the UI thread
  const pageW = useSharedValue(0);
  const collapsibleSV = useSharedValue(0); // = identityHeight
  const headerHeight = identityHeight + pinnedHeight;

  useEffect(() => {
    pageW.value = pageWidth ?? 0;
  }, [pageWidth, pageW]);
  useEffect(() => {
    collapsibleSV.value = identityHeight;
  }, [identityHeight, collapsibleSV]);

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(scrollY.value, collapsibleSV.value) }],
  }));

  // Sliding active-tab underline, driven continuously by the pager's horizontal
  // offset so it tracks the swipe (and animated jumps) instead of snapping. Pill
  // geometry is mirrored to the UI thread for the interpolation.
  const pagerX = useSharedValue(0);
  const pillsSV = useSharedValue<{ x: number; width: number }[]>([]);
  // While a programmatic jump is in flight, hold the destination page so the pager
  // scroll handler slides the underline across without walking `active` through the
  // intermediate pages. Reset to -1 when idle.
  const jumpTarget = useSharedValue(-1);
  useEffect(() => {
    pillsSV.value = pillLayouts;
  }, [pillLayouts, pillsSV]);
  const underlineStyle = useAnimatedStyle(() => {
    const pills = pillsSV.value;
    if (pills.length === 0 || pageW.value <= 0) return { width: 0, transform: [{ translateX: 0 }] };
    const last = pills.length - 1;
    const pos = Math.min(last, Math.max(0, pagerX.value / pageW.value));
    const i = Math.min(last, Math.floor(pos));
    const next = Math.min(last, i + 1);
    const t = pos - i;
    const a = pills[i];
    const b = pills[next];
    if (!a || !b) return { width: 0, transform: [{ translateX: 0 }] };
    return {
      width: a.width + (b.width - a.width) * t,
      transform: [{ translateX: a.x + (b.x - a.x) * t }],
    };
  });

  const data = useMemo(() => {
    if (!bundle) return null;
    const { rounds, holes, shots, putts, reviews } = bundle;
    const reviewsByRound = new Map<string, PostRoundReview>();
    for (const rv of reviews) reviewsByRound.set(rv.roundId, rv);
    return {
      rounds: rounds.filter((r) => r.completedAt != null),
      holesByRound: groupBy<Hole>(holes, (h) => h.roundId),
      shotsByRound: groupBy<Shot>(shots, (s) => s.roundId),
      puttsByRound: groupBy<Putt>(putts, (p) => p.roundId),
      reviewsByRound,
    };
  }, [bundle]);

  const filteredRounds = useMemo(() => {
    if (!data) return null;
    let rounds = data.rounds;
    if (holeFilter !== 'all') rounds = rounds.filter((r) => r.holeCount === holeFilter);
    if (roundsFilter !== 'all') rounds = rounds.slice(0, roundsFilter);
    return rounds;
  }, [data, holeFilter, roundsFilter]);

  const view = useMemo(() => {
    if (!data || !filteredRounds) return null;
    return {
      stats: aggregateStats(filteredRounds, data.holesByRound, data.shotsByRound, data.puttsByRound),
      trend: perRoundTrend(filteredRounds, data.holesByRound),
      review: aggregateReview(filteredRounds, data.reviewsByRound),
    };
  }, [data, filteredRounds]);

  const driver = useMemo(() => {
    if (!data || !filteredRounds) return null;
    return aggregateDriver(
      filteredRounds,
      data.holesByRound,
      data.shotsByRound,
      driveClubFilter === 'all' ? null : driveClubFilter,
    );
  }, [data, filteredRounds, driveClubFilter]);

  const driveDistance = useMemo(
    () => (data && filteredRounds ? aggregateDriveDistance(filteredRounds, data.holesByRound) : null),
    [data, filteredRounds],
  );

  const approach = useMemo(() => {
    if (!data || !filteredRounds) return null;
    return aggregateApproach(
      filteredRounds,
      data.holesByRound,
      data.shotsByRound,
      clubFilter === 'all' ? null : clubFilter,
    );
  }, [data, filteredRounds, clubFilter]);

  // Career records (never filtered) + the career best round.
  const career = useMemo(() => {
    if (!data) return null;
    const bests = aggregatePersonalBests(data.rounds, data.holesByRound);
    const derived = perRoundTrend(data.rounds, data.holesByRound);
    const bestRound =
      derived.length > 0 ? derived.reduce((b, d) => (d.toPar18 < b.toPar18 ? d : b)) : null;
    return { bests, bestRound };
  }, [data]);

  const approachClubsUsed = useMemo(
    () =>
      data && filteredRounds
        ? sortByClubOrder(distinctClubs(filteredRounds, data.holesByRound, 'approachClub'))
        : [],
    [data, filteredRounds],
  );
  const driveClubsUsed = useMemo(
    () =>
      data && filteredRounds
        ? sortByDriveLength(distinctClubs(filteredRounds, data.holesByRound, 'driveClub'))
        : [],
    [data, filteredRounds],
  );
  const clubOptions = useMemo<DropdownOption<ClubFilter>[]>(
    () => [{ value: 'all', short: 'All clubs', label: 'All clubs' }, ...approachClubsUsed.map((c) => ({ value: c, label: c }))],
    [approachClubsUsed],
  );
  const driveClubOptions = useMemo<DropdownOption<ClubFilter>[]>(
    () => [{ value: 'all', short: 'All clubs', label: 'All clubs' }, ...driveClubsUsed.map((c) => ({ value: c, label: c }))],
    [driveClubsUsed],
  );

  useEffect(() => {
    if (clubFilter !== 'all' && !approachClubsUsed.includes(clubFilter)) setClubFilter('all');
  }, [approachClubsUsed, clubFilter]);
  useEffect(() => {
    if (driveClubFilter !== 'all' && !driveClubsUsed.includes(driveClubFilter)) setDriveClubFilter('all');
  }, [driveClubsUsed, driveClubFilter]);

  const centerPill = (i: number) => {
    const x = pillLayouts[i]?.x;
    if (x == null) return;
    railRef.current?.scrollTo({ x: Math.max(0, x - 80), animated: true });
  };

  const onPillLayout = (i: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setPillLayouts((prev) => {
      const existing = prev[i];
      if (existing && existing.x === x && existing.width === width) return prev;
      const next = [...prev];
      next[i] = { x, width };
      return next;
    });
  };

  // Align every non-active page's vertical offset to the current collapse depth so
  // swiping to a neighbor never pops the masthead in or out.
  const syncInactive = useCallback(() => {
    const target = Math.min(scrollY.value, collapsibleSV.value);
    for (let i = 0; i < SECTIONS.length; i++) {
      if (i === activeIndex.value) continue;
      pageRefs.current[i]?.current?.scrollTo({ y: target, animated: false });
    }
  }, [scrollY, collapsibleSV, activeIndex]);

  // Latest settle handler behind a stable ref, so the (worklet) pager scroll handler
  // can invoke it via scheduleOnRN without capturing stale pill/section state.
  const onSettleRef = useRef<(idx: number) => void>(() => {});
  onSettleRef.current = (idx: number) => {
    setActive(idx);
    centerPill(idx);
    setVisited((prev) => (prev.has(idx) ? prev : new Set(prev).add(idx)));
    syncInactive();
  };
  const dispatchSettle = useCallback((idx: number) => onSettleRef.current(idx), []);

  const onPagerScroll = useAnimatedScrollHandler((e) => {
    pagerX.value = e.contentOffset.x; // slides the underline
    if (pageW.value <= 0) return;
    const idx = Math.min(
      SECTIONS.length - 1,
      Math.max(0, Math.round(e.contentOffset.x / pageW.value)),
    );
    if (jumpTarget.value >= 0) {
      // Programmatic jump in flight: don't walk `active` (or mount) through the
      // intermediate pages; release once we land on the destination.
      if (idx === jumpTarget.value) jumpTarget.value = -1;
      return;
    }
    if (idx !== activeIndex.value) {
      activeIndex.value = idx;
      // Clamp so the destination inherits the collapsed/expanded state, not a jump.
      scrollY.value = Math.min(scrollY.value, collapsibleSV.value);
      scheduleOnRN(dispatchSettle, idx);
    }
  });

  const goToSection = (i: number) => {
    if (pageWidth == null || i === active) return;
    jumpTarget.value = i;
    setActive(i);
    activeIndex.value = i;
    centerPill(i);
    setVisited((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    syncInactive();
    pagerRef.current?.scrollTo({ x: i * pageWidth, animated: true });
  };

  // Concise window label for the deep-section trend captions ("FIR % · Last 20").
  const windowLabel = roundsFilter === 'all' ? 'All rounds' : `Last ${roundsFilter}`;
  // Title-case summary shown on the collapsed filter chip.
  const filterWindowText = roundsFilter === 'all' ? 'All Rounds' : `Last ${roundsFilter} Rounds`;
  const filterHolesText = holeFilter === 'all' ? 'All Holes' : `${holeFilter} Holes`;

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  const deepReady = data && view && driver && driveDistance && approach && career;

  return (
    <Screen padded={false} marks>
      <View
        style={styles.flex}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && width !== pageWidth) setPageWidth(width);
          if (height > 0 && height !== pageHeight) setPageHeight(height);
        }}>
        {/* Fixed header over the pager: the masthead collapses on scroll while the
            section rail + filter stay pinned. */}
        <Animated.View style={[styles.header, headerStyle]} pointerEvents="box-none">
          {/* identity masthead — the collapsible part */}
          <View
            style={styles.identity}
            onLayout={(e) => setIdentityHeight(e.nativeEvent.layout.height)}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {fullName || 'Golfer'}
              </ThemedText>
              <Pressable
                onPress={() => router.push('/rounds' as never)}
                accessibilityRole="button"
                accessibilityLabel="My rounds"
                hitSlop={8}
                style={({ pressed }) => [styles.roundsAction, pressed && styles.pressed]}>
                <ThemedText style={styles.roundsLinkLabel}>My Rounds</ThemedText>
                <IconSymbol name="chevron.right" size={13} color={colors.textMuted} />
              </Pressable>
            </View>
            {user?.username ? (
              <ThemedText type="muted" style={styles.handle} numberOfLines={1}>
                @{user.username}
              </ThemedText>
            ) : null}
          </View>

          {/* section rail + filter — the pinned part */}
          <View
            style={styles.stickyHeader}
            onLayout={(e) => setPinnedHeight(e.nativeEvent.layout.height)}>
            <ScrollView
              ref={railRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.railScroll}
              contentContainerStyle={styles.rail}>
              {SECTIONS.map((s, i) => (
                <Pressable
                  key={s.key}
                  onPress={() => goToSection(i)}
                  onLayout={(e) => onPillLayout(i, e)}
                  style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
                  <ThemedText style={[styles.tabText, i === active && styles.tabTextActive]}>
                    {s.label}
                  </ThemedText>
                  <View style={styles.tabUnderline} />
                </Pressable>
              ))}
              <Animated.View pointerEvents="none" style={[styles.railUnderline, underlineStyle]} />
            </ScrollView>
            <View style={styles.filters}>
              <Pressable
                onPress={() => setFilterOpen((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Change filters"
                style={({ pressed }) => [styles.filterChip, pressed && styles.pressed]}>
                <ThemedText style={styles.filterChipText}>
                  {filterWindowText} · {filterHolesText}
                </ThemedText>
                <IconSymbol name={filterOpen ? 'chevron.up' : 'chevron.down'} size={13} color={colors.textMuted} />
              </Pressable>
            </View>
            {filterOpen ? (
              <Animated.View
                style={styles.filterExpand}
                entering={FadeIn.duration(180)}
                exiting={FadeOut.duration(140)}>
                <View style={styles.filterGroup}>
                  <ThemedText type="caption" style={styles.filterGroupLabel}>
                    ROUNDS
                  </ThemedText>
                  <SegmentedControl
                    seed="me-window"
                    options={ROUND_SEGMENTS}
                    value={String(roundsFilter)}
                    onChange={(v) => setRoundsFilter(v === 'all' ? 'all' : (Number(v) as RoundsFilter))}
                  />
                </View>
                <View style={styles.filterGroup}>
                  <ThemedText type="caption" style={styles.filterGroupLabel}>
                    HOLES
                  </ThemedText>
                  <SegmentedControl
                    seed="me-holes"
                    options={HOLE_SEGMENTS}
                    value={String(holeFilter)}
                    onChange={(v) => setHoleFilter(v === 'all' ? 'all' : (Number(v) as HoleCountFilter))}
                  />
                </View>
              </Animated.View>
            ) : null}
            <SketchDivider seed="me-rail-rule" />
          </View>
        </Animated.View>

        {/* Horizontal pager: one page per section, each with its own vertical scroll */}
        {pageWidth != null && pageHeight != null && headerHeight > 0 ? (
          <Animated.ScrollView
            ref={pagerRef}
            style={styles.flex}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            onScroll={onPagerScroll}
            onScrollBeginDrag={() => {
              jumpTarget.value = -1;
              syncInactive();
            }}
            scrollEventThrottle={16}>
            {SECTIONS.map((s, i) => (
              <SwipePage
                key={s.key}
                index={i}
                width={pageWidth}
                height={pageHeight}
                paddingTop={headerHeight}
                paddingBottom={tabBarHeight + spacing.xxl}
                minContentHeight={pageHeight + identityHeight}
                activeIndex={activeIndex}
                scrollY={scrollY}
                registerRef={registerPage}>
                {i === 0 ? (
                  <MeSummaryViewBase
                    scrollable={false}
                    bundle={bundle}
                    bottomInset={0}
                    showFilters={false}
                    holeFilter={holeFilter}
                    roundsFilter={roundsFilter}
                    onHoleFilter={setHoleFilter}
                    onRoundsFilter={setRoundsFilter}
                    onNavigateSection={(key) => goToSection(SECTIONS.findIndex((x) => x.key === key))}
                  />
                ) : visited.has(i) && deepReady ? (
                  <View style={styles.page}>
                    <SectionContent
                      sectionKey={SECTIONS[i].key}
                      view={view!}
                      driver={driver!}
                      driveDistance={driveDistance!}
                      approach={approach!}
                      windowLabel={windowLabel}
                      holeFilter={holeFilter}
                      careerBests={career!.bests}
                      careerBest={career!.bestRound}
                      clubFilter={clubFilter}
                      clubOptions={clubOptions}
                      onClubChange={setClubFilter}
                      driveClubFilter={driveClubFilter}
                      driveClubOptions={driveClubOptions}
                      onDriveClubChange={setDriveClubFilter}
                    />
                  </View>
                ) : null}
              </SwipePage>
            ))}
          </Animated.ScrollView>
        ) : null}
      </View>

      {tooltip.show ? <SetupCoachmark onDismiss={tooltip.dismiss} /> : null}
      <TourNudge />
      <EdgeSwipeOpener />
    </Screen>
  );
}

// One pager page: a fixed-size wrapper (so the row pages cleanly) around a vertical
// scroll that reserves the header's height and, while active, drives the shared
// scrollY that collapses the masthead.
function SwipePage({
  index,
  width,
  height,
  paddingTop,
  paddingBottom,
  minContentHeight,
  activeIndex,
  scrollY,
  registerRef,
  children,
}: {
  index: number;
  width: number;
  height: number;
  paddingTop: number;
  paddingBottom: number;
  // Floor on the scroll content so even a short section can scroll far enough to
  // reach the collapsed-header state — keeps the masthead consistent across pages.
  minContentHeight: number;
  activeIndex: SharedValue<number>;
  scrollY: SharedValue<number>;
  registerRef: (index: number, ref: AnimatedRef<Animated.ScrollView>) => void;
  children: ReactNode;
}) {
  const ref = useAnimatedRef<Animated.ScrollView>();
  useEffect(() => {
    registerRef(index, ref);
  }, [index, ref, registerRef]);
  const onScroll = useAnimatedScrollHandler((e) => {
    if (activeIndex.value === index) scrollY.value = e.contentOffset.y;
  });
  return (
    <View style={{ width, height }}>
      <Animated.ScrollView
        ref={ref}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop, paddingBottom, minHeight: minContentHeight }}>
        {children}
      </Animated.ScrollView>
    </View>
  );
}

function SectionContent({
  sectionKey,
  view,
  driver,
  driveDistance,
  approach,
  windowLabel,
  holeFilter,
  careerBests,
  careerBest,
  clubFilter,
  clubOptions,
  onClubChange,
  driveClubFilter,
  driveClubOptions,
  onDriveClubChange,
}: {
  sectionKey: SectionKey;
  view: StatsView;
  driver: DriverStats;
  driveDistance: DriveDistanceStats;
  approach: ApproachStats;
  windowLabel: string;
  holeFilter: HoleCountFilter;
  careerBests: PersonalBests;
  careerBest: RoundDerived | null;
  clubFilter: ClubFilter;
  clubOptions: DropdownOption<ClubFilter>[];
  onClubChange: (v: ClubFilter) => void;
  driveClubFilter: ClubFilter;
  driveClubOptions: DropdownOption<ClubFilter>[];
  onDriveClubChange: (v: ClubFilter) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { stats, trend, review } = view;
  const uniform = stats.uniformLength;
  const empty = stats.roundCount === 0;

  const scoringPoints = trend.map((t) => (uniform ? t.toPar : t.toPar18));
  const firPoints = trend.map((t) => (t.firPct != null ? t.firPct * 100 : null)).filter((v): v is number => v != null);
  const girPoints = trend.map((t) => (t.girPct != null ? t.girPct * 100 : null)).filter((v): v is number => v != null);
  const udPoints = trend.map((t) => (t.udPct != null ? t.udPct * 100 : null)).filter((v): v is number => v != null);
  const decisionPoints = review.decisionTrend.filter((v): v is number => v != null);

  const drivePins: TargetPin[] = driver.pins.map((p) => ({ ...p, variant: 'muted' }));
  const approachPins: TargetPin[] = approach.pins.map((p) => ({ ...p, variant: 'muted' }));

  const made10 = stats.puttBuckets.filter((b) => b.ft <= 10).reduce(
    (acc, b) => ({ makes: acc.makes + b.makes, total: acc.total + b.total }),
    { makes: 0, total: 0 },
  );
  const made10Pct = made10.total > 0 ? Math.round((made10.makes / made10.total) * 100) : null;

  if (empty) {
    return (
      <ThemedText type="muted" style={styles.centerText}>
        No rounds match these filters yet.
      </ThemedText>
    );
  }

  switch (sectionKey) {
    case 'scoring':
      return (
        <Cascade style={styles.sectionStack}>
          <SectionHero
            caption={uniform ? 'Scoring average' : 'To par / 18'}
            value={
              uniform
                ? stats.avgScore != null
                  ? stats.avgScore.toFixed(1)
                  : '—'
                : stats.avgToPar18 != null
                  ? formatToPar(stats.avgToPar18, 1)
                  : '—'
            }
            delta={windowDelta(scoringPoints)}
            deltaLowerIsBetter
            points={scoringPoints}
            baseline={uniform ? undefined : 0}
            baselineLabel={uniform ? undefined : 'par'}
            formatValue={(n) => (uniform ? `${Math.round(n)}` : formatToPar(n))}
            trendLabel={`Scoring · ${windowLabel}`}
          />
          <Section title="By par">
            <ScoringFigures stats={stats} holeFilter={holeFilter} />
            <FiguresRow
              size="md"
              boxed
              seed="bypar-figs"
              figures={[
                { label: 'Par 3 avg', value: formatAvg(stats.perPar.par3) },
                { label: 'Par 4 avg', value: formatAvg(stats.perPar.par4) },
                { label: 'Par 5 avg', value: formatAvg(stats.perPar.par5) },
              ]}
            />
          </Section>
          <Section title="Score distribution">
            <ScoreDistributionBars distribution={stats.distribution} />
          </Section>
          <Section title="Trouble">
            <FiguresRow
              size="md"
              boxed
              seed="trouble-figs"
              figures={[
                {
                  label: 'Pen/Round',
                  value: stats.penaltiesPerRound != null ? stats.penaltiesPerRound.toFixed(1) : '—',
                },
                { label: '3-Putts', value: String(stats.threePuttCount) },
                { label: '1-Putts', value: String(stats.onePuttCount) },
              ]}
            />
          </Section>
        </Cascade>
      );

    case 'driving':
      return (
        <Cascade style={styles.sectionStack}>
          <SectionHero
            caption="Fairways in regulation"
            value={formatPct(stats.firPct)}
            delta={windowDelta(firPoints)}
            points={firPoints}
            formatValue={(n) => `${Math.round(n)}%`}
            trendLabel={`FIR % · ${windowLabel}`}
          />
          <DropdownSelect
            seed="drive-club"
            options={driveClubOptions}
            value={driveClubFilter}
            onChange={onDriveClubChange}
            block
          />
          <View style={styles.targetWrap}>
            <DriverTarget pins={drivePins} width={260} height={390} pinSize={6} />
          </View>
          <ThemedText type="muted" style={styles.centerText}>
            {driver.driverTotal} drive{driver.driverTotal === 1 ? '' : 's'} · LF {driver.driverLanes.LF} · CF{' '}
            {driver.driverLanes.CF} · RF {driver.driverLanes.RF}
          </ThemedText>
          <FiguresRow
            size="md"
            boxed
            seed="drive-figs"
            figures={[
              {
                label: 'Avg distance',
                value: driveDistance.avgYds != null ? `${Math.round(driveDistance.avgYds)} yd` : '—',
              },
              {
                label: 'Long drive',
                value: careerBests.longestDrive != null ? `${careerBests.longestDrive} yd` : '—',
              },
            ]}
          />
          <Section title="Miss tendency">
            <ValueBars
              rows={[
                { key: 'cf', label: 'Fairway', value: driver.driverLanes.CF, display: pctOf(driver.driverLanes.CF, driver.driverTotal) },
                { key: 'lf', label: 'Left', value: driver.driverLanes.LF, display: pctOf(driver.driverLanes.LF, driver.driverTotal) },
                { key: 'rf', label: 'Right', value: driver.driverLanes.RF, display: pctOf(driver.driverLanes.RF, driver.driverTotal) },
              ]}
            />
          </Section>
          {driveDistance.count > 0 ? (
            <Section title="Drive distance by club">
              <ValueBars
                rows={driveDistance.byClub.map((c) => ({
                  key: c.club,
                  label: c.club,
                  value: c.avgYds,
                  display: `${Math.round(c.avgYds)} yds`,
                }))}
              />
            </Section>
          ) : null}
          {driveDistance.count > 0 ? (
            <Section title="Drive distribution">
              <SplitDistanceBars
                seedPrefix="drive"
                successLabel="Fairway"
                failLabel="Missed"
                rows={driveDistance.distribution.map((b) => ({
                  key: b.label,
                  label: b.label,
                  success: b.hit,
                  total: b.total,
                }))}
              />
            </Section>
          ) : null}
        </Cascade>
      );

    case 'approach':
      return (
        <Cascade style={styles.sectionStack}>
          <SectionHero
            caption="Greens in regulation"
            value={formatPct(stats.girPct)}
            delta={windowDelta(girPoints)}
            points={girPoints}
            formatValue={(n) => `${Math.round(n)}%`}
            trendLabel={`GIR % · ${windowLabel}`}
          />
          <DropdownSelect
            seed="club"
            options={clubOptions}
            value={clubFilter}
            onChange={onClubChange}
            block
          />
          <View style={styles.targetWrap}>
            <ApproachTarget pins={approachPins} size={300} pinSize={7} />
          </View>
          <FiguresRow
            size="md"
            boxed
            seed="appr-figs"
            figures={[
              {
                label: 'Avg proximity',
                value:
                  approach.avgApproachProximity != null
                    ? `${Math.round(approach.avgApproachProximity)} ft`
                    : '—',
              },
              { label: 'Miss bias', value: formatMissDirection(approach.missBias) },
            ]}
          />
          <Section title={`Greens hit · ${clubFilter === 'all' ? 'All clubs' : clubFilter}`}>
            <SplitDistanceBars
              seedPrefix="appr"
              successLabel="Green hit"
              failLabel="Missed"
              rows={approach.approachByDistance.map((b) => ({
                key: b.label,
                label: b.label,
                success: b.hit,
                total: b.total,
              }))}
            />
          </Section>
        </Cascade>
      );

    case 'short':
      return (
        <Cascade style={styles.sectionStack}>
          <SectionHero
            caption="Up & down"
            value={formatPct(stats.udPct)}
            delta={windowDelta(udPoints)}
            points={udPoints}
            formatValue={(n) => `${Math.round(n)}%`}
            trendLabel={`U&D % · ${windowLabel}`}
          />
          <Section title="Make % by distance">
            <SplitDistanceBars
              seedPrefix="putt"
              successLabel="Made"
              failLabel="Missed"
              rows={stats.puttBuckets.map((b) => ({
                key: String(b.ft),
                label: b.label,
                success: b.makes,
                total: b.total,
              }))}
            />
          </Section>
          <FiguresRow
            size="md"
            boxed
            seed="putt-figs"
            figures={[
              {
                label: 'Putts/Round',
                value: stats.puttsPerRound != null ? stats.puttsPerRound.toFixed(1) : '—',
              },
              {
                label: 'Putts/Hole',
                value: stats.puttsPerHole != null ? stats.puttsPerHole.toFixed(2) : '—',
              },
              { label: 'Made <10ft', value: made10Pct != null ? `${made10Pct}%` : '—' },
            ]}
          />
          <FiguresRow
            size="md"
            boxed
            seed="short-figs"
            figures={[
              {
                label: 'Chips/Round',
                value: stats.chipShotsPerRound != null ? stats.chipShotsPerRound.toFixed(1) : '—',
              },
              {
                label: 'Sand/Round',
                value: stats.sandShotsPerRound != null ? stats.sandShotsPerRound.toFixed(1) : '—',
              },
              { label: '3-Putts', value: String(stats.threePuttCount) },
            ]}
          />
        </Cascade>
      );

    case 'mental':
      return (
        <Cascade style={styles.sectionStack}>
          <SectionHero
            caption="Decision making"
            value={review.avgDecision != null ? review.avgDecision.toFixed(1) : '—'}
            suffix="/10"
            delta={windowDelta(decisionPoints)}
            points={decisionPoints}
            formatValue={(n) => n.toFixed(1)}
            trendLabel={`Decision · ${windowLabel}`}
          />
          <MentalGameCard review={review} empty={false} />
        </Cascade>
      );

    case 'bests':
      return (
        <Cascade style={styles.sectionStack}>
          <ThemedText type="caption" style={styles.bestsKicker}>
            CAREER HIGHS
          </ThemedText>
          {careerBest ? <BestRoundCallout best={careerBest} uniform={careerBest.holesPlayed === 18} /> : null}
          <FiguresRow
            size="md"
            boxed
            seed="bests-figs"
            figures={[
              {
                label: 'Longest drive',
                value: careerBests.longestDrive != null ? `${careerBests.longestDrive} yd` : '—',
              },
              {
                label: 'Fewest putts',
                value: careerBests.fewestPutts != null ? String(careerBests.fewestPutts) : '—',
              },
              {
                label: 'Most birdies',
                value: careerBests.mostBirdies != null ? String(careerBests.mostBirdies) : '—',
              },
            ]}
          />
        </Cascade>
      );

    default:
      return null;
  }
}

function pctOf(n: number, total: number): string {
  return total > 0 ? `${Math.round((n / total) * 100)}%` : '—';
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pressed: { opacity: 0.6 },
    header: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: colors.background,
    },
    identity: {
      gap: spacing.xs,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    name: {
      flex: 1,
      fontFamily: fonts.serifBold,
      fontSize: 33,
      lineHeight: 40,
      letterSpacing: -0.4,
      color: colors.textPrimary,
    },
    handle: {
      fontSize: 14,
      lineHeight: 20,
    },
    roundsAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    roundsLinkLabel: {
      fontFamily: fonts.serif,
      fontSize: 15,
      lineHeight: 20,
      color: colors.textMuted,
    },
    stickyHeader: {
      backgroundColor: colors.background,
    },
    railScroll: {
      flexGrow: 0,
      flexShrink: 0,
    },
    filters: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    filterChipText: {
      fontFamily: fonts.serif,
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    filterExpand: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    filterGroup: {
      gap: spacing.xs,
    },
    filterGroupLabel: {
      color: colors.textMuted,
      paddingHorizontal: spacing.xs,
    },
    rail: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      gap: spacing.md,
    },
    tab: {
      alignItems: 'center',
    },
    tabText: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textMuted,
    },
    tabTextActive: {
      fontFamily: fonts.serifBold,
      color: colors.textPrimary,
    },
    tabUnderline: {
      alignSelf: 'stretch',
      height: 2,
      marginTop: 5,
      borderRadius: 1,
      backgroundColor: 'transparent',
    },
    railUnderline: {
      position: 'absolute',
      left: 0,
      bottom: spacing.sm,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.accent,
    },
    page: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.lg,
    },
    sectionStack: {
      gap: spacing.lg,
    },
    targetWrap: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    centerText: {
      textAlign: 'center',
    },
    bestsKicker: {
      color: colors.accent,
    },
  });
