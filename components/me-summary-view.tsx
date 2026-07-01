import { router } from 'expo-router';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';

import { ApproachTarget } from '@/components/approach-target';
import { Cascade } from '@/components/cascade';
import { DeltaBadge } from '@/components/delta-badge';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { FiguresRow } from '@/components/figures-row';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole, PostRoundReview, Putt, Shot } from '@/lib/data/models';
import { type StatsBundle } from '@/lib/data/stats';
import {
  aggregateApproach,
  aggregateDriveDistance,
  aggregateDriver,
  aggregatePersonalBests,
  aggregateReview,
  aggregateStats,
  deriveRound,
  formatDelta,
  formatHandicapIndex,
  formatMissDirection,
  formatToPar,
  handicapHistoryFor,
  perRoundTrend,
  windowDelta,
  type HoleCountFilter,
  type RoundsFilter,
} from '@/lib/lifetime-stats';
import { formatPct } from '@/lib/stats';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

const HOLE_FILTERS: DropdownOption<HoleCountFilter>[] = [
  { value: 'all', short: 'All', label: 'All lengths' },
  { value: 18, short: '18', label: '18-hole' },
  { value: 9, short: '9', label: '9-hole' },
];

const ROUND_FILTERS: DropdownOption<RoundsFilter>[] = [
  { value: 20, short: 'Last 20', label: 'Last 20 rounds' },
  { value: 40, short: 'Last 40', label: 'Last 40 rounds' },
  { value: 60, short: 'Last 60', label: 'Last 60 rounds' },
  { value: 'all', short: 'All rounds', label: 'All rounds' },
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

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function monthLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length < 2 || parts.some(Number.isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function shortDate(iso: string): string {
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function MeSummaryViewBase({
  header,
  bundle,
  bottomInset,
  disableNavigation = false,
  showFilters = true,
  scrollable = true,
  holeFilter: holeFilterProp,
  roundsFilter: roundsFilterProp,
  onHoleFilter,
  onRoundsFilter,
  onNavigateSection,
}: {
  header?: ReactNode;
  bundle: StatsBundle | null;
  bottomInset: number;
  /** When false, render the body inline (no own ScrollView) so a parent scroll
   *  owns the vertical scrolling — used by the Me tab's single-scroll shell. The
   *  tour keeps the default self-scrolling behavior. */
  scrollable?: boolean;
  /** Render the cards inert (no deep-links) — used by the onboarding tour, which
   *  shows the summary purely as a payoff preview. */
  disableNavigation?: boolean;
  /** Show the inline hole/window dropdowns. Off when a parent (the stats pager)
   *  owns the filters in its own chrome. */
  showFilters?: boolean;
  /** Controlled filters — when provided, the parent owns filter state so it can
   *  share it across the Overview page and the deep sections. Falls back to local
   *  state (the tour) when omitted. */
  holeFilter?: HoleCountFilter;
  roundsFilter?: RoundsFilter;
  onHoleFilter?: (v: HoleCountFilter) => void;
  onRoundsFilter?: (v: RoundsFilter) => void;
  /** Jump the parent pager to a deep section. When omitted (or navigation
   *  disabled) card taps are inert. */
  onNavigateSection?: (section: string) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [holeFilterState, setHoleFilterState] = useState<HoleCountFilter>(18);
  const [roundsFilterState, setRoundsFilterState] = useState<RoundsFilter>(20);
  const holeFilter = holeFilterProp ?? holeFilterState;
  const roundsFilter = roundsFilterProp ?? roundsFilterState;
  const setHoleFilter = onHoleFilter ?? setHoleFilterState;
  const setRoundsFilter = onRoundsFilter ?? setRoundsFilterState;

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

  const handicap = useMemo(
    () => (data ? handicapHistoryFor(data.rounds, data.holesByRound) : null),
    [data],
  );

  const stats = useMemo(
    () =>
      data && filteredRounds
        ? aggregateStats(filteredRounds, data.holesByRound, data.shotsByRound, data.puttsByRound)
        : null,
    [data, filteredRounds],
  );
  const trend = useMemo(
    () => (data && filteredRounds ? perRoundTrend(filteredRounds, data.holesByRound) : null),
    [data, filteredRounds],
  );
  const review = useMemo(
    () => (data && filteredRounds ? aggregateReview(filteredRounds, data.reviewsByRound) : null),
    [data, filteredRounds],
  );
  const driver = useMemo(
    () =>
      data && filteredRounds
        ? aggregateDriver(filteredRounds, data.holesByRound, data.shotsByRound, null)
        : null,
    [data, filteredRounds],
  );
  const approach = useMemo(
    () =>
      data && filteredRounds
        ? aggregateApproach(filteredRounds, data.holesByRound, data.shotsByRound, null)
        : null,
    [data, filteredRounds],
  );
  const driveDistance = useMemo(
    () => (data && filteredRounds ? aggregateDriveDistance(filteredRounds, data.holesByRound) : null),
    [data, filteredRounds],
  );
  const personalBests = useMemo(
    () => (data ? aggregatePersonalBests(data.rounds, data.holesByRound) : null),
    [data],
  );

  // The most recent completed round (by date, then created order).
  const lastRound = useMemo(() => {
    if (!data || data.rounds.length === 0) return null;
    const newest = [...data.rounds].sort((a, b) => {
      const d = b.datePlayed.localeCompare(a.datePlayed);
      return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
    })[0];
    return deriveRound(newest, data.holesByRound.get(newest.id) ?? []);
  }, [data]);

  const go = (section: string) => {
    if (disableNavigation) return;
    onNavigateSection?.(section);
  };

  if (!data || !stats || !trend || !review || !driver || !approach || !driveDistance || !handicap) {
    return (
      <View style={[styles.loadingPad, scrollable ? styles.flex : styles.loadingInline]}>
        {header}
        <View style={styles.loadingSpinner}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  const empty = stats.roundCount === 0;
  const roundDate = new Map(data.rounds.map((r) => [r.id, r.datePlayed]));
  const windowed =
    roundsFilter === 'all' ? handicap.points : handicap.points.slice(-roundsFilter);
  const handicapPoints = windowed.map((p) => p.index);
  const firstHcp = windowed[0]?.index ?? null;
  const startMonth = monthLabel(roundDate.get(windowed[0]?.roundId ?? ''));
  const handicapDelta =
    handicap.current != null && firstHcp != null ? handicap.current - firstHcp : null;

  const per18 = trend.map((d) => (d.totalScore / d.holesPlayed) * 18);
  const avgPer18 = mean(per18);
  const bestPer18 = per18.length ? Math.round(Math.min(...per18)) : null;

  const firPoints = trend.map((t) => (t.firPct != null ? t.firPct * 100 : null)).filter((v): v is number => v != null);
  const girPoints = trend.map((t) => (t.girPct != null ? t.girPct * 100 : null)).filter((v): v is number => v != null);
  const udPoints = trend.map((t) => (t.udPct != null ? t.udPct * 100 : null)).filter((v): v is number => v != null);
  const scoringPoints = trend.map((t) => (stats.uniformLength ? t.toPar : t.toPar18));
  const decisionPoints = review.decisionTrend.filter((v): v is number => v != null);

  const drivePins: TargetPin[] = driver.pins.map((p) => ({ ...p, variant: 'muted' }));
  const approachPins: TargetPin[] = approach.pins.map((p) => ({ ...p, variant: 'muted' }));

  // In the Me tab (non-scrollable), the cards cascade in on each visit; the tour
  // (scrollable) keeps them static.
  const Container = scrollable ? View : Cascade;

  return (
    <SummaryShell scrollable={scrollable} bottomInset={bottomInset}>
      {header}

        {showFilters ? (
          <View style={styles.filters}>
            <DropdownSelect seed="hole" options={HOLE_FILTERS} value={holeFilter} onChange={setHoleFilter} />
            <DropdownSelect seed="rounds" options={ROUND_FILTERS} value={roundsFilter} onChange={setRoundsFilter} block />
          </View>
        ) : null}

        {/* A user with rounds but an over-narrow filter gets a message; a brand-new
            user (no rounds at all) falls through to the full layout with — placeholders. */}
        {empty && data.rounds.length > 0 ? (
          <ThemedText type="muted" style={styles.centerText}>
            No rounds match these filters yet.
          </ThemedText>
        ) : (
          <Container style={styles.cascade}>
            {/* Handicap hero → Overview */}
            <Pressable onPress={() => go('overview')} style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText type="caption" style={styles.accentCaption}>
                HANDICAP
              </ThemedText>
              <View style={styles.hcpRow}>
                <ThemedText style={styles.hcpValue}>
                  {handicap.current != null ? formatHandicapIndex(handicap.current) : '—'}
                </ThemedText>
                <View style={styles.hcpRight}>
                  <DeltaBadge delta={handicapDelta} format={formatDelta} />
                  {startMonth ? (
                    <ThemedText type="caption" style={styles.mutedCaption}>
                      SINCE {startMonth.toUpperCase()}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
              <MiniSparkline points={handicapPoints} height={64} />
              <View style={styles.hcpScale}>
                <ThemedText style={styles.scaleText}>
                  {firstHcp != null ? formatHandicapIndex(firstHcp) : '—'}
                  {startMonth ? ` · ${startMonth}` : ''}
                </ThemedText>
                <ThemedText style={[styles.scaleText, styles.scaleNow]}>
                  {handicap.current != null ? `${formatHandicapIndex(handicap.current)} now` : '—'}
                </ThemedText>
              </View>
            </Pressable>

            {/* 3-up summary */}
            <FiguresRow
              boxed
              seed="me-summary"
              figures={[
                { label: 'Rounds', value: stats.roundCount > 0 ? String(stats.roundCount) : '—' },
                { label: 'Avg /18', value: avgPer18 != null ? avgPer18.toFixed(1) : '—' },
                { label: 'Best', value: bestPer18 != null ? String(bestPer18) : '—' },
              ]}
            />

            {/* Last round → that round's summary */}
            {lastRound ? (
              <Pressable
                onPress={
                  disableNavigation
                    ? undefined
                    : () => router.push(`/round/${lastRound.round.id}/summary` as never)
                }
                style={({ pressed }) => pressed && styles.pressed}>
                <SketchSurface seed="me-last-round" radius={12} fill={colors.background} style={styles.lastRound}>
                  <View style={styles.lastRoundInfo}>
                    <ThemedText type="caption" style={styles.mutedCaption}>
                      LAST ROUND
                    </ThemedText>
                    <ThemedText style={styles.lastRoundCourse} numberOfLines={1}>
                      {lastRound.round.courseName}
                    </ThemedText>
                  </View>
                  <View style={styles.lastRoundScore}>
                    <View style={styles.lastRoundScoreRow}>
                      <ThemedText style={styles.lastRoundGross}>{lastRound.totalScore}</ThemedText>
                      <ThemedText style={styles.lastRoundToPar}>{formatToPar(lastRound.toPar)}</ThemedText>
                    </View>
                    <ThemedText type="muted" style={styles.lastRoundDate}>
                      {shortDate(lastRound.round.datePlayed)}
                    </ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={15} color={colors.borderStrong} />
                </SketchSurface>
              </Pressable>
            ) : null}

            {/* Driving → Driving */}
            <SkillCard
              onPress={() => go('driving')}
              visual={
                <View style={styles.driveVisual}>
                  <DriverTarget
                    pins={drivePins}
                    width={120}
                    height={150}
                    pinSize={5}
                    showYardages={false}
                    showLanes={false}
                    bordered={false}
                  />
                </View>
              }
              title="Driving"
              pct={formatPct(stats.firPct)}
              delta={windowDelta(firPoints)}
              pctLabel="Fairways hit"
              figures={[
                {
                  value: driveDistance.avgYds != null ? `${Math.round(driveDistance.avgYds)}` : '—',
                  suffix: driveDistance.avgYds != null ? ' yd' : undefined,
                  label: 'Avg drive',
                },
                { value: driver.missBias ?? '—', label: 'Miss bias' },
              ]}
            />

            {/* Approach → Approach */}
            <SkillCard
              onPress={() => go('approach')}
              visual={
                <View style={styles.approachVisual}>
                  <ApproachTarget pins={approachPins} size={120} pinSize={5} />
                </View>
              }
              title="Approach"
              pct={formatPct(stats.girPct)}
              delta={windowDelta(girPoints)}
              pctLabel="Greens hit"
              figures={[
                {
                  value:
                    approach.avgApproachProximity != null
                      ? `${Math.round(approach.avgApproachProximity)}`
                      : '—',
                  suffix: approach.avgApproachProximity != null ? ' ft' : undefined,
                  label: 'Avg proximity',
                },
                { value: formatMissDirection(approach.missBias), label: 'Miss bias' },
              ]}
            />

            {/* Putting → Short game */}
            <Pressable onPress={() => go('short')} style={({ pressed }) => pressed && styles.pressed}>
              <SketchSurface seed="me-putting" radius={14} fill={colors.background} style={styles.puttCard}>
                <View style={styles.puttHeader}>
                  <ThemedText style={styles.cardTitle}>Putting % By Distance</ThemedText>
                </View>
                <View style={styles.puttBars}>
                  {stats.puttBuckets.map((b) => {
                    const pct = b.makePct != null ? Math.round(b.makePct * 100) : null;
                    return (
                      <View key={b.ft} style={styles.puttCol}>
                        <ThemedText style={styles.puttPct}>{pct != null ? `${pct}%` : '—'}</ThemedText>
                        <View style={styles.puttTrack}>
                          <View
                            style={{
                              height: `${pct ?? 0}%`,
                              backgroundColor: (pct ?? 0) >= 50 ? colors.accent : colors.roughDeep,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                              width: '100%',
                            }}
                          />
                        </View>
                        <ThemedText style={styles.puttLabel}>{b.label}</ThemedText>
                      </View>
                    );
                  })}
                </View>
              </SketchSurface>
            </Pressable>

            {/* Combined ledger */}
            <SketchSurface seed="me-ledger" radius={14} fill={colors.background} style={styles.ledger}>
              <LedgerRow
                value={
                  stats.uniformLength
                    ? stats.avgScore != null
                      ? stats.avgScore.toFixed(1)
                      : '—'
                    : stats.avgToPar18 != null
                      ? formatToPar(stats.avgToPar18, 1)
                      : '—'
                }
                label="Scoring AVG"
                points={scoringPoints}
                delta={windowDelta(scoringPoints)}
                lowerIsBetter
                onPress={() => go('scoring')}
                divider
              />
              <LedgerRow
                value={formatPct(stats.udPct)}
                label="U&D"
                points={udPoints}
                delta={windowDelta(udPoints)}
                onPress={() => go('short')}
                divider
              />
              <LedgerRow
                value={review.avgDecision != null ? review.avgDecision.toFixed(1) : '—'}
                label="AVG Decision Making"
                points={decisionPoints}
                delta={windowDelta(decisionPoints)}
                onPress={() => go('mental')}
              />
            </SketchSurface>

            {/* Personal bests → Bests */}
            <View style={styles.pbSection}>
              <ThemedText type="caption" style={styles.mutedCaption}>
                PERSONAL BESTS
              </ThemedText>
              <View style={styles.pbRow}>
                <BestTile
                  onPress={() => go('bests')}
                  value={personalBests?.longestDrive != null ? String(personalBests.longestDrive) : '—'}
                  suffix={personalBests?.longestDrive != null ? ' yd' : undefined}
                  label="Longest drive"
                />
                <BestTile
                  onPress={() => go('bests')}
                  value={personalBests?.fewestPutts != null ? String(personalBests.fewestPutts) : '—'}
                  label="Fewest putts"
                />
                <BestTile
                  onPress={() => go('bests')}
                  value={personalBests?.mostBirdies != null ? String(personalBests.mostBirdies) : '—'}
                  label="Most birdies"
                />
              </View>
            </View>
          </Container>
        )}
    </SummaryShell>
  );
}

// The overview body either owns its own scroll (tour / standalone) or renders
// inline so the Me tab's single outer ScrollView can drive the collapsing header.
function SummaryShell({
  scrollable,
  bottomInset,
  children,
}: {
  scrollable: boolean;
  bottomInset: number;
  children: ReactNode;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  if (!scrollable) return <View style={styles.content}>{children}</View>;
  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.lg }]}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

type SkillFigure = { value: string; suffix?: string; label: string };

function SkillCard({
  onPress,
  visual,
  title,
  pct,
  delta,
  pctLabel,
  figures,
}: {
  onPress: () => void;
  visual: ReactNode;
  title: string;
  pct: string;
  delta: number | null;
  pctLabel: string;
  figures: SkillFigure[];
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <SketchSurface seed={`me-skill-${title}`} radius={14} fill={colors.background} style={styles.skillCard}>
        <View style={styles.skillRow}>
          {visual}
          <View style={styles.skillDivider} />
          <View style={styles.skillBody}>
            <View>
              <View style={styles.skillPctRow}>
                <ThemedText style={styles.skillPct}>{pct}</ThemedText>
                <DeltaBadge delta={delta} lowerIsBetter={false} format={formatDelta} />
              </View>
              <ThemedText type="caption" style={styles.mutedCaption}>
                {pctLabel.toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.skillFigures}>
              {figures.map((f) => (
                <View key={f.label} style={styles.skillFigure}>
                  <ThemedText style={styles.skillFigureValue} numberOfLines={1}>
                    {f.value}
                    {f.suffix ? <ThemedText style={styles.skillFigureSuffix}>{f.suffix}</ThemedText> : null}
                  </ThemedText>
                  <ThemedText type="caption" style={styles.mutedCaption} numberOfLines={2}>
                    {f.label.toUpperCase()}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>
      </SketchSurface>
    </Pressable>
  );
}

function LedgerRow({
  value,
  label,
  points,
  delta,
  lowerIsBetter = false,
  onPress,
  divider,
}: {
  value: string;
  label: string;
  points: number[];
  delta: number | null;
  lowerIsBetter?: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ledgerRow, divider && styles.ledgerDivider, pressed && styles.pressed]}>
      <View style={styles.ledgerLockup}>
        <ThemedText style={styles.ledgerValue}>{value}</ThemedText>
        <ThemedText style={styles.ledgerLabel} numberOfLines={2}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.ledgerChart}>
        <MiniSparkline points={points} height={32} />
      </View>
      <DeltaBadge delta={delta} lowerIsBetter={lowerIsBetter} format={formatDelta} size="sm" />
    </Pressable>
  );
}

function BestTile({
  onPress,
  value,
  suffix,
  label,
}: {
  onPress: () => void;
  value: string;
  suffix?: string;
  label: string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pbTileWrap, pressed && styles.pressed]}>
      <SketchSurface seed={`me-pb-${label}`} radius={12} style={styles.pbTile}>
        <ThemedText style={styles.pbValue} numberOfLines={1}>
          {value}
          {suffix ? <ThemedText style={styles.pbSuffix}>{suffix}</ThemedText> : null}
        </ThemedText>
        <ThemedText type="caption" style={[styles.mutedCaption, styles.pbLabel]} numberOfLines={2}>
          {label.toUpperCase()}
        </ThemedText>
      </SketchSurface>
    </Pressable>
  );
}

// A compact line sparkline with a subtle gradient fill and no axis labels or
// point markers — the chrome-free chart the editorial cards want (TrendChart
// carries min/max axis labels, which crowd a 32px row).
function MiniSparkline({
  points,
  height = 32,
}: {
  points: number[];
  height?: number;
}) {
  const colors = useColors();
  const gradientId = `mini-grad-${useId().replace(/:/g, '')}`;
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };
  const geom = useMemo(() => {
    if (width === 0 || points.length < 2) return null;
    const pad = 4;
    let min = Math.min(...points);
    let max = Math.max(...points);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;
    const coords = points.map((v, i) => ({
      x: pad + (i / (points.length - 1)) * innerW,
      y: pad + innerH - ((v - min) / (max - min)) * innerH,
    }));
    const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
    const last = coords[coords.length - 1];
    let length = 0;
    for (let i = 1; i < coords.length; i++) {
      length += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
    }
    const areaPath = `M${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)} ${coords
      .slice(1)
      .map((c) => `L${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ')} L${last.x.toFixed(1)} ${(height - pad).toFixed(1)} L${coords[0].x.toFixed(1)} ${(
      height - pad
    ).toFixed(1)} Z`;
    return { line, last, areaPath, length };
  }, [width, height, points]);

  // Draw-on: trace the line (strokeDashoffset → 0) and fade the fill in whenever the
  // sparkline (re)appears.
  const drawLength = geom?.length ?? 0;
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!geom) return;
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [geom?.line, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: drawLength * (1 - progress.value),
  }));
  const areaProps = useAnimatedProps(() => ({
    fillOpacity: progress.value,
  }));

  return (
    <View onLayout={onLayout} style={{ height, width: '100%' }}>
      {geom ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.2} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <AnimatedPath d={geom.areaPath} fill={`url(#${gradientId})`} animatedProps={areaProps} />
          <AnimatedPolyline
            points={geom.line}
            fill="none"
            stroke={colors.accent}
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeDasharray={geom.length}
            animatedProps={lineProps}
          />
        </Svg>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pressed: { opacity: 0.6 },
    loadingPad: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    loadingSpinner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingInline: {
      minHeight: 240,
    },
    content: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      gap: spacing.md,
    },
    cascade: {
      gap: spacing.md,
    },
    filters: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    centerText: {
      textAlign: 'center',
      paddingVertical: spacing.xl,
    },
    accentCaption: {
    },
    mutedCaption: {
      color: colors.textMuted,
    },
    hcpRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    hcpValue: {
      fontFamily: fonts.serifBold,
      fontSize: 60,
      lineHeight: 70,
      letterSpacing: -0.5,
      color: colors.textPrimary,
    },
    hcpRight: {
      alignItems: 'flex-end',
      gap: 2,
      paddingBottom: spacing.xs,
    },
    hcpScale: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 2,
    },
    scaleText: {
      fontFamily: fonts.serif,
      fontSize: 11,
      color: colors.textMuted,
    },
    scaleNow: {
      color: colors.accent,
    },
    lastRound: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    lastRoundInfo: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    lastRoundCourse: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    lastRoundScore: {
      alignItems: 'flex-end',
      gap: 2,
    },
    lastRoundScoreRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs,
    },
    lastRoundGross: {
      fontFamily: fonts.serifBold,
      fontSize: 22,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    lastRoundToPar: {
      fontFamily: fonts.serif,
      fontSize: 13,
      color: colors.accent,
    },
    lastRoundDate: {
      fontSize: 11,
    },
    cardTitle: {
      fontFamily: fonts.serif,
      fontSize: 15,
      lineHeight: 18,
      color: colors.textPrimary,
    },
    skillCard: {
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    skillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    driveVisual: {
      width: 120,
      alignSelf: 'center',
    },
    approachVisual: {
      width: 120,
      alignSelf: 'center',
      alignItems: 'center',
    },
    skillDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    skillBody: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      gap: spacing.md,
    },
    skillFigure: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    skillPctRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    skillPct: {
      fontFamily: fonts.serifBold,
      fontSize: 34,
      lineHeight: 40,
      color: colors.textPrimary,
    },
    skillFigures: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    skillFigureValue: {
      fontFamily: fonts.serif,
      fontSize: 20,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    skillFigureSuffix: {
      fontFamily: fonts.serif,
      fontSize: 11,
      color: colors.textMuted,
    },
    puttCard: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    puttHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    puttBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      height: 116,
    },
    puttCol: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
    },
    puttPct: {
      fontFamily: fonts.serif,
      fontSize: 13,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    puttTrack: {
      flex: 1,
      width: 28,
      justifyContent: 'flex-end',
    },
    puttLabel: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: colors.textMuted,
      marginTop: spacing.xs,
    },
    ledger: {
      paddingHorizontal: spacing.md,
    },
    ledgerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    ledgerDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    ledgerLockup: {
      width: 132,
      gap: 2,
    },
    ledgerValue: {
      fontFamily: fonts.serifBold,
      fontSize: 26,
      lineHeight: 28,
      color: colors.textPrimary,
    },
    ledgerLabel: {
      fontFamily: fonts.serif,
      fontSize: 13,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    ledgerChart: {
      flex: 1,
    },
    pbSection: {
      gap: spacing.sm,
    },
    pbRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    pbTileWrap: {
      flex: 1,
    },
    pbTile: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
      minHeight: 76,
      alignItems: 'center',
    },
    pbValue: {
      fontFamily: fonts.serifBold,
      fontSize: 24,
      lineHeight: 26,
      color: colors.textPrimary,
    },
    pbLabel: {
      textAlign: 'center',
    },
    pbSuffix: {
      fontFamily: fonts.serif,
      fontSize: 12,
      color: colors.textMuted,
    },
  });
