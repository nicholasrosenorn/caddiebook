import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';

import { ApproachTarget } from '@/components/approach-target';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import {
  Chapter,
  ScoreDistributionBars,
  Section,
  SplitDistanceBars,
  StatTile,
  ValueBars,
} from '@/components/stats-figures';
import { StrokesGainedCard } from '@/components/strokes-gained-card';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { sortByClubOrder, sortByDriveLength } from '@/constants/clubs';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole, PostRoundReview, Putt, Round, Shot } from '@/lib/data/models';
import { useClubYardages } from '@/lib/data/settings';
import { useStatsBundle, type StatsBundle } from '@/lib/data/stats';
import type { HandicapHistory } from '@/lib/handicap';
import {
  aggregateApproach,
  aggregateDriveDistance,
  aggregateDriver,
  aggregateReview,
  aggregateStats,
  aggregateStrokesGained,
  formatHandicapIndex,
  formatToPar,
  handicapHistoryFor,
  perRoundTrend,
  type ApproachStats,
  type DriveDistanceStats,
  type DriverStats,
  type HoleCountFilter,
  type LifetimeStats,
  type ReviewInsights,
  type RoundDerived,
  type RoundsFilter,
  type StrokesGainedStats
} from '@/lib/lifetime-stats';
import { formatPct } from '@/lib/stats';
import {
  bandVsBaseline,
  benchmarkSG,
  driverDistanceFor,
  formatSG,
  SG_BASELINES,
} from '@/lib/strokes-gained';

type Data = {
  rounds: Round[]; // completed only, newest first
  holesByRound: Map<string, Hole[]>;
  shotsByRound: Map<string, Shot[]>;
  puttsByRound: Map<string, Putt[]>;
  reviewsByRound: Map<string, PostRoundReview>;
};

type StatsView = {
  stats: LifetimeStats;
  trend: RoundDerived[];
  review: ReviewInsights;
};

// 'all' = every club; otherwise a club name from the bag.
type ClubFilter = 'all' | string;

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

// Distinct, non-null club values logged on the given rounds' holes — the set a
// club dropdown should offer (only clubs actually used for that shot type).
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

// Tab usage: owns the bottom-tab height + the live stats query, then hands them
// to the shared base. The base takes its data + bottom inset as plain props so it
// can also render outside the tabs navigator (the onboarding tour reuses it with a
// sample bundle, where `useBottomTabBarHeight` would throw).
export function ProgressView({ header }: { header?: ReactNode }) {
  const tabBarHeight = useBottomTabBarHeight();
  const bundle = useStatsBundle();
  return <ProgressViewBase header={header} bundle={bundle.data ?? null} bottomInset={tabBarHeight} />;
}

export function ProgressViewBase({
  header,
  bundle,
  bottomInset,
}: {
  header?: ReactNode;
  bundle: StatsBundle | null;
  bottomInset: number;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [holeFilter, setHoleFilter] = useState<HoleCountFilter>(18);
  const [roundsFilter, setRoundsFilter] = useState<RoundsFilter>(20);
  const [clubFilter, setClubFilter] = useState<ClubFilter>('all');
  const [driveClubFilter, setDriveClubFilter] = useState<ClubFilter>('all');
  const { yardages } = useClubYardages();

  // One cached server read (refetched on focus/foreground) replaces the old
  // five whole-table SQLite queries; the groupings stay client-side.
  const data = useMemo<Data | null>(() => {
    if (!bundle) return null;
    const { rounds, holes, shots, putts, reviews } = bundle;
    const reviewsByRound = new Map<string, PostRoundReview>();
    for (const rv of reviews) reviewsByRound.set(rv.roundId, rv);
    return {
      rounds: rounds.filter((r) => r.completedAt != null),
      holesByRound: groupBy(holes, (h) => h.roundId),
      shotsByRound: groupBy(shots, (s) => s.roundId),
      puttsByRound: groupBy(putts, (p) => p.roundId),
      reviewsByRound,
    };
  }, [bundle]);

  // Rounds matching the hole-count + recency filters; shared by every section.
  const filteredRounds = useMemo(() => {
    if (!data) return null;
    let rounds = data.rounds;
    if (holeFilter !== 'all') rounds = rounds.filter((r) => r.holeCount === holeFilter);
    if (roundsFilter !== 'all') rounds = rounds.slice(0, roundsFilter);
    return rounds;
  }, [data, holeFilter, roundsFilter]);

  // Always computed across the player's full history so the scoring-bar value is
  // their true current index and each chart point is the index they actually held
  // at that round. The recency dropdown only windows the chart (in StatsBody).
  const handicap = useMemo<HandicapHistory | null>(() => {
    if (!data) return null;
    return handicapHistoryFor(data.rounds, data.holesByRound);
  }, [data]);

  // Driver distance for the Off-the-Tee hole-length estimate: the player's logged
  // yardage, else a default off their current Handicap Index.
  const driverDistance = useMemo(
    () => driverDistanceFor(yardages['Driver'], handicap?.current ?? null),
    [yardages, handicap],
  );

  // Strokes gained recomputes when the filtered set or driver distance changes.
  const sg = useMemo<StrokesGainedStats | null>(() => {
    if (!data || !filteredRounds) return null;
    return aggregateStrokesGained(
      filteredRounds,
      data.holesByRound,
      data.shotsByRound,
      data.puttsByRound,
      { driverDistance },
    );
  }, [data, filteredRounds, driverDistance]);

  const view = useMemo<StatsView | null>(() => {
    if (!data || !filteredRounds) return null;
    const rounds = filteredRounds;
    const stats = aggregateStats(
      rounds,
      data.holesByRound,
      data.shotsByRound,
      data.puttsByRound,
    );
    const trend = perRoundTrend(rounds, data.holesByRound);
    const review = aggregateReview(rounds, data.reviewsByRound);
    return { stats, trend, review };
  }, [data, filteredRounds]);

  // Driver dispersion recomputes only when its club filter (or data) changes.
  const driver = useMemo<DriverStats | null>(() => {
    if (!data || !filteredRounds) return null;
    return aggregateDriver(
      filteredRounds,
      data.holesByRound,
      data.shotsByRound,
      driveClubFilter === 'all' ? null : driveClubFilter,
    );
  }, [data, filteredRounds, driveClubFilter]);

  // Drive distance (by club + distribution) is club-filter independent.
  const driveDistance = useMemo<DriveDistanceStats | null>(() => {
    if (!data || !filteredRounds) return null;
    return aggregateDriveDistance(filteredRounds, data.holesByRound);
  }, [data, filteredRounds]);

  // Approach sections recompute only when the club filter (or data) changes.
  const approach = useMemo<ApproachStats | null>(() => {
    if (!data || !filteredRounds) return null;
    return aggregateApproach(
      filteredRounds,
      data.holesByRound,
      data.shotsByRound,
      clubFilter === 'all' ? null : clubFilter,
    );
  }, [data, filteredRounds, clubFilter]);

  // Each dropdown offers only the clubs actually logged for that shot type in
  // the current round set (loft order for approach, longest→shortest for drives).
  const approachClubsUsed = useMemo(() => {
    if (!data || !filteredRounds) return [];
    return sortByClubOrder(distinctClubs(filteredRounds, data.holesByRound, 'approachClub'));
  }, [data, filteredRounds]);

  const driveClubsUsed = useMemo(() => {
    if (!data || !filteredRounds) return [];
    return sortByDriveLength(distinctClubs(filteredRounds, data.holesByRound, 'driveClub'));
  }, [data, filteredRounds]);

  const clubOptions = useMemo<DropdownOption<ClubFilter>[]>(
    () => [
      { value: 'all', short: 'All clubs', label: 'All clubs' },
      ...approachClubsUsed.map((c) => ({ value: c, label: c })),
    ],
    [approachClubsUsed],
  );

  const driveClubOptions = useMemo<DropdownOption<ClubFilter>[]>(
    () => [
      { value: 'all', short: 'All clubs', label: 'All clubs' },
      ...driveClubsUsed.map((c) => ({ value: c, label: c })),
    ],
    [driveClubsUsed],
  );

  // If a hole-count/recency change drops the selected club from the set, fall
  // back to "All" so the dropdown label and the filtered data stay in sync.
  useEffect(() => {
    if (clubFilter !== 'all' && !approachClubsUsed.includes(clubFilter)) {
      setClubFilter('all');
    }
  }, [approachClubsUsed, clubFilter]);

  useEffect(() => {
    if (driveClubFilter !== 'all' && !driveClubsUsed.includes(driveClubFilter)) {
      setDriveClubFilter('all');
    }
  }, [driveClubsUsed, driveClubFilter]);

  if (!data) {
    return (
      <View style={[styles.flex, styles.loadingPad]}>
        {header}
        <View style={styles.loadingSpinner}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  const isEmpty = data.rounds.length === 0;

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.lg }]}
        // Both Progress and My Rounds stay mounted together, so each has its own
        // scroll view. iOS only auto-adjusts the top content inset of one of
        // several coexisting scroll views, which made the header jump vertically
        // when switching tabs — pin both to "never" so they line up exactly.
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        {header}

        <View style={styles.filters}>
          <DropdownSelect
            seed="hole"
            options={HOLE_FILTERS}
            value={holeFilter}
            onChange={setHoleFilter}
          />
          <DropdownSelect
            seed="rounds"
            options={ROUND_FILTERS}
            value={roundsFilter}
            onChange={setRoundsFilter}
            block
          />
        </View>

        {view && approach && driver && driveDistance && handicap && sg ? (
          <StatsBody
            view={view}
            handicap={handicap}
            sg={sg}
            roundsFilter={roundsFilter}
            empty={view.stats.roundCount === 0}
            hasAny={!isEmpty}
            holeFilter={holeFilter}
            approach={approach}
            clubFilter={clubFilter}
            clubOptions={clubOptions}
            onClubChange={setClubFilter}
            driver={driver}
            driveDistance={driveDistance}
            driveClubFilter={driveClubFilter}
            driveClubOptions={driveClubOptions}
            onDriveClubChange={setDriveClubFilter}
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

function StatsBody({
  view,
  handicap,
  sg,
  roundsFilter,
  empty,
  hasAny,
  holeFilter,
  approach,
  clubFilter,
  clubOptions,
  onClubChange,
  driver,
  driveDistance,
  driveClubFilter,
  driveClubOptions,
  onDriveClubChange,
}: {
  view: StatsView;
  handicap: HandicapHistory;
  sg: StrokesGainedStats;
  roundsFilter: RoundsFilter;
  /** No rounds matched the active filters — render the dashed skeleton. */
  empty: boolean;
  /** Whether any completed rounds exist at all (drives the empty hint copy). */
  hasAny: boolean;
  holeFilter: HoleCountFilter;
  approach: ApproachStats;
  clubFilter: ClubFilter;
  clubOptions: DropdownOption<ClubFilter>[];
  onClubChange: (value: ClubFilter) => void;
  driver: DriverStats;
  driveDistance: DriveDistanceStats;
  driveClubFilter: ClubFilter;
  driveClubOptions: DropdownOption<ClubFilter>[];
  onDriveClubChange: (value: ClubFilter) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { stats, trend, review } = view;
  // The SG baseline dropdown lives on the card but drives the distance-band
  // charts in the Approach/Putting sections too, so its state is lifted here.
  const [sgBaselineKey, setSgBaselineKey] = useState('10');
  const sgBaseline = SG_BASELINES.find((b) => b.key === sgBaselineKey) ?? SG_BASELINES[0];
  // Full-history points (true index at each round), windowed to the recency
  // dropdown only — the scoring-bar value stays the unfiltered current index.
  const windowedHandicap =
    roundsFilter === 'all' ? handicap.points : handicap.points.slice(-roundsFilter);
  const handicapPoints = windowedHandicap.map((p) => p.index);
  // SG trend is stored per-round vs Tour; shift it by the selected baseline so the
  // 0-line means "even with that golfer". Lives in the Over-time section now.
  const hasSG = sg.sg.holesWithSG > 0;
  const sgBench = sgBaseline.hcp == null ? 0 : benchmarkSG('total', sgBaseline.hcp);
  const sgTrend = sg.trend.map((p) => p - sgBench);
  // Per-band SG (shifted to the selected baseline) trailing the distance bars.
  const showSg = !empty && hasSG;
  const approachSg = bandVsBaseline(sg.approachBands, 'approach', sgBaseline.hcp);
  const puttingSg = bandVsBaseline(sg.puttingBands, 'putting', sgBaseline.hcp);
  const drivingSg = bandVsBaseline(sg.drivingBands, 'ott', sgBaseline.hcp);
  const showTrends =
    trend.length >= 2 || handicapPoints.length >= 2 || (hasSG && sgTrend.length >= 2);
  const uniform = stats.uniformLength;
  const approachPins: TargetPin[] = approach.pins.map((p) => ({ ...p, variant: 'muted' }));
  const drivePins: TargetPin[] = driver.pins.map((p) => ({ ...p, variant: 'muted' }));

  return (
    <>
      {empty ? (
        <ThemedText type="muted" style={styles.centerText}>
          {hasAny
            ? 'No rounds match these filters yet.'
            : 'Finish a round to start building your stats.'}
        </ThemedText>
      ) : null}

      {/* ── Scoring: the headline figures + the over-time narrative ─────────── */}
      <Chapter>
        {/* Scoring headline — adapts to the hole-count filter. The caption spells
            out the active scope so these filtered figures read distinctly from
            the masthead's lifetime ones. */}
        <Section title="Scoring">
          <ScoringFigures stats={stats} holeFilter={holeFilter} />
          {stats.bestRound ? (
            <BestRoundCallout best={stats.bestRound} uniform={uniform} />
          ) : null}
          <View style={styles.statRow}>
            <StatTile label="Par 3 avg" value={formatAvg(stats.perPar.par3)} />
            <StatTile label="Par 4 avg" value={formatAvg(stats.perPar.par4)} />
            <StatTile label="Par 5 avg" value={formatAvg(stats.perPar.par5)} />
          </View>
        </Section>

        {/* The four percentages + putting trio */}
        <Section title="The numbers">
          <View style={styles.statGrid}>
            <View style={styles.statRow}>
              <StatTile label="GIR" value={formatPct(stats.girPct)} />
              <StatTile label="FIR" value={formatPct(stats.firPct)} />
              <StatTile label="U&D" value={formatPct(stats.udPct)} />
            </View>
            <View style={styles.statRow}>
              <StatTile
                label="Putts/Hole"
                value={stats.puttsPerHole != null ? stats.puttsPerHole.toFixed(2) : '—'}
              />
              <StatTile label="3-Putts" value={empty ? '—' : String(stats.threePuttCount)} />
              <StatTile label="1-Putts" value={empty ? '—' : String(stats.onePuttCount)} />
            </View>
          </View>
        </Section>

        {/* Score distribution */}
        <Section title="Score distribution">
          <ScoreDistributionBars distribution={stats.distribution} empty={empty} />
        </Section>

        {/* Trends over time */}
        {showTrends ? (
          <Section title="Over time">
            <TrendCard
              title="Handicap index"
              caption="index"
              points={handicapPoints}
              formatValue={formatHandicapIndex}
            />
            <TrendCard
              title="Scoring"
              caption={uniform ? 'to par' : 'to par · per 18'}
              points={trend.map((t) => (uniform ? t.toPar : t.toPar18))}
              baseline={0}
              baselineLabel="par"
              formatValue={(n) => formatToPar(n)}
            />
            <TrendCard
              title="Greens in regulation"
              caption="%"
              points={trend
                .map((t) => (t.girPct != null ? t.girPct * 100 : null))
                .filter((v): v is number => v != null)}
              formatValue={(n) => `${Math.round(n)}%`}
            />
            <TrendCard
              title="Putts"
              caption={uniform ? 'per round' : 'per 18'}
              points={trend.map((t) => (uniform ? t.totalPutts : t.puttsPer18))}
              formatValue={(n) => n.toFixed(n % 1 === 0 ? 0 : 1)}
            />
            {hasSG ? (
              <TrendCard
                title="Strokes gained"
                caption={`per 18 · vs ${sgBaseline.label}`}
                points={sgTrend}
                baseline={0}
                baselineLabel={sgBaseline.label}
                formatValue={(n) => formatSG(n)}
              />
            ) : null}
          </Section>
        ) : null}
      </Chapter>

      {/* ── Strokes gained vs the PGA Tour baseline + handicap scenarios ────── */}
      {!empty && sg.sg.holesWithSG > 0 ? (
        <Chapter>
          <Section title="Strokes gained">
            <StrokesGainedCard
              sg={sg.sg}
              baselineKey={sgBaselineKey}
              onBaselineChange={setSgBaselineKey}
            />
          </Section>
        </Chapter>
      ) : null}

      {/* ── Shot quality: where the strokes are won and lost, by distance ───── */}
      <Chapter>
        {/* Drive dispersion */}
        <Section title="Drive dispersion">
          <DropdownSelect
            seed="drive-club"
            options={driveClubOptions}
            value={driveClubFilter}
            onChange={onDriveClubChange}
            block
          />
          <View style={styles.targetWrap}>
            <DriverTarget pins={drivePins} width={280} height={420} pinSize={6} />
          </View>
          <ThemedText type="muted" style={[styles.centerText, { marginTop: spacing.md }]}>
            {driver.driverTotal} drive{driver.driverTotal === 1 ? '' : 's'} · LF{' '}
            {driver.driverLanes.LF} · CF {driver.driverLanes.CF} · RF {driver.driverLanes.RF}
          </ThemedText>
          {stats.noApproachHoles > 0 ? (
            <ThemedText type="muted" style={[styles.centerText, { marginTop: spacing.xs }]}>
              {stats.noApproachHoles} left no shot at the green
            </ThemedText>
          ) : null}
        </Section>

        {/* Drive distance by club — club-independent, so it carries its own
            caption rather than honouring the dispersion dropdown. */}
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
            <ThemedText type="muted" style={[styles.centerText, { marginTop: spacing.sm }]}>
              {driveDistance.count} drive{driveDistance.count === 1 ? '' : 's'}
              {driveDistance.avgYds != null
                ? ` · avg ${Math.round(driveDistance.avgYds)} yds`
                : ''}
            </ThemedText>
          </Section>
        ) : null}

        {/* Drive distribution — 25-yd bands split by fairways found, SG trailing. */}
        {driveDistance.count > 0 ? (
          <Section title="Drive distribution">
            <SplitDistanceBars
              seedPrefix="drive"
              successLabel="Fairway"
              failLabel="Missed"
              rows={driveDistance.distribution.map((b, i) => ({
                key: b.label,
                label: b.label,
                success: b.hit,
                total: b.total,
                sg: showSg && sg.drivingBands[i]?.holes > 0 ? drivingSg[i] : undefined,
              }))}
            />
            {showSg ? (
              <ThemedText type="caption">SG = STROKES GAINED VS {sgBaseline.label.toUpperCase()}</ThemedText>
            ) : null}
          </Section>
        ) : null}

        {/* Approach dispersion — the club filter scopes both approach sections. */}
        <Section title="Approach dispersion">
          <DropdownSelect
            seed="club"
            options={clubOptions}
            value={clubFilter}
            onChange={onClubChange}
            block
          />
          <View style={styles.targetWrap}>
            <ApproachTarget pins={approachPins} size={320} pinSize={7} />
          </View>
          <ThemedText type="muted" style={styles.centerText}>
            {approach.approachTotal} approach{approach.approachTotal === 1 ? '' : 'es'}
            {approach.avgApproachProximity != null
              ? ` · avg ${Math.round(approach.avgApproachProximity)} ft when on`
              : ''}
          </ThemedText>
        </Section>

        {/* Approach distances, split by green hit / missed. SG trails each band —
            but only with "All clubs", since the SG bands aren't club-scoped. */}
        <Section
          title={`Approach distances · ${clubFilter === 'all' ? 'All clubs' : clubFilter}`}>
          <SplitDistanceBars
            seedPrefix="appr"
            successLabel="Green hit"
            failLabel="Missed"
            rows={approach.approachByDistance.map((b, i) => ({
              key: b.label,
              label: b.label,
              success: b.hit,
              total: b.total,
              sg:
                showSg && clubFilter === 'all' && sg.approachBands[i]?.holes > 0
                  ? approachSg[i]
                  : undefined,
            }))}
          />
          {showSg && clubFilter === 'all' ? (
            <ThemedText type="caption">SG = STROKES GAINED VS {sgBaseline.label.toUpperCase()}</ThemedText>
          ) : null}
        </Section>

        {/* Putting make rate by distance, with SG trailing each band */}
        <Section title="Putting by distance">
          <SplitDistanceBars
            seedPrefix="putt"
            successLabel="Made"
            failLabel="Missed"
            rows={stats.puttBuckets.map((b, i) => ({
              key: String(b.ft),
              label: b.label,
              success: b.makes,
              total: b.total,
              sg: showSg && sg.puttingBands[i]?.holes > 0 ? puttingSg[i] : undefined,
            }))}
          />
          {showSg ? (
            <ThemedText type="caption">SG = STROKES GAINED VS {sgBaseline.label.toUpperCase()}</ThemedText>
          ) : null}
        </Section>
      </Chapter>

      {/* ── Mental & trouble: the round-management story ────────────────────── */}
      <Chapter>
        {/* Trouble */}
        <Section title="Trouble & short game">
          <View style={styles.statRow}>
            <StatTile
              label="Pen/Round"
              value={stats.penaltiesPerRound != null ? stats.penaltiesPerRound.toFixed(1) : '—'}
            />
            <StatTile
              label="Chips/Round"
              value={stats.chipShotsPerRound != null ? stats.chipShotsPerRound.toFixed(1) : '—'}
            />
            <StatTile
              label="Sand/Round"
              value={stats.sandShotsPerRound != null ? stats.sandShotsPerRound.toFixed(1) : '—'}
            />
          </View>
        </Section>

        {/* Review insights */}
        {review.count > 0 || empty ? (
          <Section title="Mental game">
            <MentalGameCard review={review} empty={empty} />
          </Section>
        ) : null}
      </Chapter>

      <View style={{ height: spacing.xl }} />
    </>
  );
}

function formatAvg(value: number | null): string {
  return value != null ? value.toFixed(2) : '—';
}

// The filtered scoring figures (the masthead carries the lifetime ones).
// Single hole-count → a real scoring average. Mixed → fair per-18 to-par.
function ScoringFigures({
  stats,
  holeFilter,
}: {
  stats: LifetimeStats;
  holeFilter: HoleCountFilter;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const single = holeFilter !== 'all';
  const primaryLabel = single ? 'Scoring avg' : 'To par /18';
  const primaryValue = single
    ? stats.avgScore != null
      ? stats.avgScore.toFixed(1)
      : '—'
    : stats.avgToPar18 != null
      ? formatToPar(stats.avgToPar18, 1)
      : '—';
  const secondaryValue = stats.avgToPar != null ? formatToPar(stats.avgToPar, 1) : '—';

  return (
    <View style={styles.statRow}>
      <StatTile label={primaryLabel} value={primaryValue} />
      <StatTile label={single ? 'To par' : 'To par / round'} value={secondaryValue} />
    </View>
  );
}

function BestRoundCallout({ best, uniform }: { best: RoundDerived; uniform: boolean }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <SketchSurface
      seed="stats-best"
      fill={colors.accentMuted}
      stroke={colors.accent}
      style={styles.bestCard}>
      <View style={styles.bestScoreCol}>
        <ThemedText style={styles.bestScore}>
          {formatToPar(uniform ? best.toPar : best.toPar18)}
        </ThemedText>
        <ThemedText style={styles.bestScoreSuffix}>{uniform ? 'TO PAR' : 'TO PAR /18'}</ThemedText>
      </View>
      <View style={styles.bestDivider} />
      <View style={styles.bestInfo}>
        <ThemedText style={styles.bestLabel}>★ BEST ROUND</ThemedText>
        <ThemedText style={styles.bestCourse} numberOfLines={1}>
          {best.round.courseName}
        </ThemedText>
        <ThemedText type="muted">{formatDate(best.round.datePlayed)}</ThemedText>
      </View>
    </SketchSurface>
  );
}

function TrendCard({
  title,
  caption,
  points,
  baseline,
  baselineLabel,
  formatValue,
}: {
  title: string;
  caption: string;
  points: number[];
  baseline?: number;
  baselineLabel?: string;
  formatValue: (n: number) => string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  if (points.length < 2) return null;
  return (
    <View style={styles.trendBlock}>
      <View style={styles.trendHeader}>
        <ThemedText style={styles.trendTitle}>{title}</ThemedText>
        <ThemedText type="caption">{caption.toUpperCase()}</ThemedText>
      </View>
      <TrendChart
        points={points}
        baseline={baseline}
        baselineLabel={baselineLabel}
        formatValue={formatValue}
      />
      <SketchDivider seed={`trend-rule-${title}`} />
    </View>
  );
}

export function MentalGameCard({ review, empty }: { review: ReviewInsights; empty: boolean }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (empty || review.count === 0) {
    return (
      <ThemedText type="muted" style={styles.centerText}>
        Add post-round reviews to see your mental game.
      </ThemedText>
    );
  }

  const decisionPoints = review.decisionTrend.filter((v): v is number => v != null);
  const overallPoints = review.overallTrend.filter((v): v is number => v != null);

  return (
    <View style={styles.mentalBody}>
      {/* Ratings + trends — standard within-section spacing */}
      <View style={styles.sectionBody}>
        <ThemedText type="caption">
          {review.count} {review.count === 1 ? 'REVIEW' : 'REVIEWS'}
        </ThemedText>

        {/* Self-rated averages */}
        <View style={styles.statRow}>
          <StatTile
            label="Decision Making AVG"
            value={review.avgDecision != null ? `${review.avgDecision.toFixed(1)}/10` : '—'}
          />
          <StatTile
            label="Round Rating AVG"
            value={review.avgOverall != null ? `${review.avgOverall.toFixed(1)}/10` : '—'}
          />
        </View>

        {/* Rating trends — each self-hides below 2 points */}
        <TrendCard
          title="Decision making"
          caption="/10"
          points={decisionPoints}
          formatValue={(n) => n.toFixed(1)}
        />
        <TrendCard
          title="Round rating"
          caption="/10"
          points={overallPoints}
          formatValue={(n) => n.toFixed(1)}
        />
      </View>

      {/* Categorical frequency breakdowns */}
      <FrequencyBars
        caption="Costs you most strokes"
        seedPrefix="costly"
        rows={review.mostCostly}
      />
      <FrequencyBars caption="Common miss" seedPrefix="miss" rows={review.commonMiss} />
      <FrequencyBars caption="Range focus" seedPrefix="focus" rows={review.rangeFocus} />
    </View>
  );
}

// Single-accent count bars for a categorical review breakdown (modeled on
// ScoreDistributionBars). Renders nothing when there's no data for the field.
function FrequencyBars<T extends string>({
  caption,
  seedPrefix,
  rows,
}: {
  caption: string;
  seedPrefix: string;
  rows: { value: T; label: string; count: number }[];
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <View style={styles.freqBlock}>
      <ThemedText type="caption">{caption.toUpperCase()}</ThemedText>
      <View style={styles.barList}>
        {rows.map((row) => {
          const frac = row.count / max;
          return (
            <View key={row.value} style={styles.barRow}>
              <ThemedText style={[styles.barLabel, styles.freqLabel]}>{row.label}</ThemedText>
              <SketchSurface
                seed={`stats-freq-${seedPrefix}-${row.value}`}
                radius={7}
                fill={colors.surfaceAlt}
                style={styles.barTrack}>
                <View
                  style={{
                    flex: frac,
                    backgroundColor: colors.accent,
                    minWidth: 6,
                    height: '100%',
                  }}
                />
                <View style={{ flex: Math.max(0, 1 - frac) }} />
              </SketchSurface>
              <ThemedText type="muted" style={styles.barCount}>
                {row.count}
              </ThemedText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatDate(iso: string): string {
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  flex: {
    flex: 1,
  },
  loadingPad: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  loadingSpinner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  bestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  bestScoreCol: {
    alignItems: 'center',
    gap: 2,
    minWidth: 56,
  },
  bestScore: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 32,
    color: colors.accent,
  },
  bestScoreSuffix: {
    fontFamily: fonts.body,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  bestDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    opacity: 0.25,
    marginVertical: spacing.xs,
  },
  bestInfo: {
    flex: 1,
    gap: 2,
  },
  bestLabel: {
    fontFamily: fonts.body,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.accent,
  },
  bestCourse: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  statGrid: {
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trendBlock: {
    gap: spacing.sm,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendTitle: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  barList: {
    gap: spacing.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    width: 64,
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textPrimary,
  },
  barTrack: {
    flex: 1,
    height: 16,
    flexDirection: 'row',
    borderRadius: 7,
    overflow: 'hidden',
  },
  barCount: {
    width: 32,
    textAlign: 'right',
  },
  targetWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  mentalBody: {
    gap: spacing.lg,
  },
  freqBlock: {
    gap: spacing.sm,
  },
  freqLabel: {
    width: 96,
  },
});
