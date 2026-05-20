import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApproachTarget } from '@/components/approach-target';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { colors, fontFamily, spacing } from '@/constants/theme';
import {
  getAllHoles,
  getAllPutts,
  getAllReviews,
  getAllShots,
  listRounds,
} from '@/db/queries';
import type { Hole, PostRoundReview, Putt, Round, Shot } from '@/db/types';
import { clearAllRounds, seedSampleRounds } from '@/lib/dev-seed';
import {
  aggregateReview,
  aggregateStats,
  formatToPar,
  perRoundTrend,
  type HoleCountFilter,
  type LifetimeStats,
  type ReviewInsights,
  type RoundDerived,
  type RoundsFilter,
} from '@/lib/lifetime-stats';
import { formatPct } from '@/lib/stats';

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
  drivePins: TargetPin[];
  approachPins: TargetPin[];
};

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

export default function StatsScreen() {
  const [data, setData] = useState<Data | null>(null);
  const [holeFilter, setHoleFilter] = useState<HoleCountFilter>(18);
  const [roundsFilter, setRoundsFilter] = useState<RoundsFilter>('all');
  const [devBusy, setDevBusy] = useState(false);

  const load = useCallback(async () => {
    const [rounds, holes, shots, putts, reviews] = await Promise.all([
      listRounds(),
      getAllHoles(),
      getAllShots(),
      getAllPutts(),
      getAllReviews(),
    ]);
    const reviewsByRound = new Map<string, PostRoundReview>();
    for (const rv of reviews) reviewsByRound.set(rv.roundId, rv);
    setData({
      rounds: rounds.filter((r) => r.completedAt != null),
      holesByRound: groupBy(holes, (h) => h.roundId),
      shotsByRound: groupBy(shots, (s) => s.roundId),
      puttsByRound: groupBy(putts, (p) => p.roundId),
      reviewsByRound,
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const runDev = useCallback(
    async (fn: () => Promise<void>) => {
      setDevBusy(true);
      try {
        await fn();
        await load();
      } finally {
        setDevBusy(false);
      }
    },
    [load],
  );

  const view = useMemo(() => {
    if (!data) return null;
    let rounds = data.rounds;
    if (holeFilter !== 'all') rounds = rounds.filter((r) => r.holeCount === holeFilter);
    if (roundsFilter !== 'all') rounds = rounds.slice(0, roundsFilter);

    const stats = aggregateStats(
      rounds,
      data.holesByRound,
      data.shotsByRound,
      data.puttsByRound,
    );
    const trend = perRoundTrend(rounds, data.holesByRound);
    const review = aggregateReview(rounds, data.reviewsByRound);

    const drivePins: TargetPin[] = [];
    const approachPins: TargetPin[] = [];
    for (const r of rounds) {
      for (const s of data.shotsByRound.get(r.id) ?? []) {
        const pin: TargetPin = { xNorm: s.xNorm, yNorm: s.yNorm, key: s.id, variant: 'muted' };
        if (s.shotType === 'driver') drivePins.push(pin);
        else approachPins.push(pin);
      }
    }
    return { stats, trend, review, drivePins, approachPins };
  }, [data, holeFilter, roundsFilter]);

  if (!data) return <Screen />;

  const isEmpty = data.rounds.length === 0;

  return (
    <Screen padded={false} marks>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {__DEV__ ? (
          <DevBar
            busy={devBusy}
            onSeed={() => runDev(() => seedSampleRounds(70))}
            onClear={() => runDev(clearAllRounds)}
          />
        ) : null}

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

        {isEmpty || !view || view.stats.roundCount === 0 ? (
          <EmptyState hasAny={!isEmpty} />
        ) : (
          <StatsBody view={view} holeFilter={holeFilter} />
        )}
      </ScrollView>
    </Screen>
  );
}

function StatsBody({ view, holeFilter }: { view: StatsView; holeFilter: HoleCountFilter }) {
  const { stats, trend, review, drivePins, approachPins } = view;
  const showTrends = trend.length >= 2;
  const uniform = stats.uniformLength;

  return (
    <>
      {/* Sample size for the active filters */}

      {/* Scoring headline — adapts to the hole-count filter */}
      <Section title="Scoring">
        <ThemedText type="caption" style={styles.sampleLine}>
        {stats.roundCount} {stats.roundCount === 1 ? 'ROUND' : 'ROUNDS'} ·{' '}
        {stats.holesTracked} {stats.holesTracked === 1 ? 'HOLE' : 'HOLES'}
      </ThemedText>
        <ScoringCard stats={stats} holeFilter={holeFilter} />
        {stats.bestRound ? (
          <BestRoundCallout best={stats.bestRound} uniform={uniform} />
        ) : null}
        <View style={styles.perParRow}>
          <PerParTile label="Par 3" value={stats.perPar.par3} />
          <PerParTile label="Par 4" value={stats.perPar.par4} />
          <PerParTile label="Par 5" value={stats.perPar.par5} />
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
            <StatTile label="3-Putts" value={String(stats.threePuttCount)} />
            <StatTile label="1-Putts" value={String(stats.onePuttCount)} />
          </View>
        </View>
      </Section>

      {/* Trends over time */}
      {showTrends ? (
        <Section title="Over time">
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
        </Section>
      ) : null}

      {/* Score distribution */}
      <Section title="Score distribution">
        <ScoreDistributionBars distribution={stats.distribution} />
      </Section>

      {/* Driver dispersion */}
      <Section title="Driver dispersion">
        <View style={styles.targetWrap}>
          <DriverTarget pins={drivePins} width={260} height={400} pinSize={6} />
        </View>
        <ThemedText type="muted" style={[styles.centerText, {marginTop: spacing.md}]}>
          {stats.driverTotal} drive{stats.driverTotal === 1 ? '' : 's'} · LF{' '}
          {stats.driverLanes.LF} · CF {stats.driverLanes.CF} · RF {stats.driverLanes.RF}
        </ThemedText>
      </Section>

      {/* Approach dispersion */}
      <Section title="Approach dispersion">
        <View style={styles.targetWrap}>
          <ApproachTarget pins={approachPins} size={280} pinSize={7} />
        </View>
        <ThemedText type="muted" style={styles.centerText}>
          {stats.approachTotal} approach{stats.approachTotal === 1 ? '' : 'es'}
          {stats.avgApproachProximity != null
            ? ` · avg ${Math.round(stats.avgApproachProximity)} ft when on`
            : ''}
        </ThemedText>
      </Section>

      {/* Approach distances, split by green hit / missed */}
      <Section title="Approach distances">
        <SplitDistanceBars
          seedPrefix="appr"
          successLabel="Green hit"
          failLabel="Missed"
          emptyText="No approach distances logged yet."
          rows={stats.approachByDistance.map((b) => ({
            key: b.label,
            label: b.label,
            success: b.hit,
            total: b.total,
          }))}
        />
      </Section>

      {/* Putting make rate by distance */}
      <Section title="Putting by distance">
        <SplitDistanceBars
          seedPrefix="putt"
          successLabel="Made"
          failLabel="Missed"
          emptyText="No putts logged yet."
          rows={stats.puttBuckets.map((b) => ({
            key: String(b.ft),
            label: b.label,
            success: b.makes,
            total: b.total,
          }))}
        />
      </Section>

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
      {review.count > 0 ? (
        <Section title="Mental Game">
          <ReviewInsightsCard review={review} />
        </Section>
      ) : null}

      <View style={{ height: spacing.xl }} />
    </>
  );
}

// Dev-only seeding controls — gated by __DEV__ at the call site.
function DevBar({
  busy,
  onSeed,
  onClear,
}: {
  busy: boolean;
  onSeed: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.devBar}>
      <Pressable style={styles.devBtn} disabled={busy} onPress={onSeed}>
        <SketchSurface
          seed="dev-seed"
          fill={colors.accent}
          stroke={colors.accent}
          radius={8}
          style={styles.devSurface}>
          <ThemedText style={styles.devSeedLabel}>
            {busy ? 'Working…' : 'Seed 70 rounds'}
          </ThemedText>
        </SketchSurface>
      </Pressable>
      <Pressable style={styles.devBtn} disabled={busy} onPress={onClear}>
        <SketchSurface seed="dev-clear" radius={8} style={styles.devSurface}>
          <ThemedText style={styles.devClearLabel}>Clear all</ThemedText>
        </SketchSurface>
      </Pressable>
    </View>
  );
}

function ScoringCard({
  stats,
  holeFilter,
}: {
  stats: LifetimeStats;
  holeFilter: HoleCountFilter;
}) {
  // Single hole-count → a real scoring average. Mixed → fair per-18 to-par.
  const single = holeFilter !== 'all';
  const primaryLabel = single ? 'SCORING AVG' : 'TO PAR /18';
  const primaryValue = single
    ? stats.avgScore != null
      ? stats.avgScore.toFixed(1)
      : '—'
    : stats.avgToPar18 != null
      ? formatToPar(stats.avgToPar18, 1)
      : '—';
  const secondaryValue =
    stats.avgToPar != null ? formatToPar(stats.avgToPar, 1) : '—';

  return (
    <SketchSurface seed="stats-scoring" style={styles.scoringCard}>
      <View style={styles.scoringCol}>
        <ThemedText type="caption">{primaryLabel}</ThemedText>
        <ThemedText style={styles.bigScore}>{primaryValue}</ThemedText>
      </View>
      <View style={styles.scoringDivider} />
      <View style={styles.scoringCol}>
        <ThemedText type="caption">{single ? 'TO PAR' : 'TO PAR / ROUND'}</ThemedText>
        <ThemedText style={styles.bigScore}>{secondaryValue}</ThemedText>
      </View>
    </SketchSurface>
  );
}

function BestRoundCallout({ best, uniform }: { best: RoundDerived; uniform: boolean }) {
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
  if (points.length < 2) return null;
  return (
    <SketchSurface seed={`trend-${title}`} style={styles.trendCard}>
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
    </SketchSurface>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <SketchSurface seed={`stats-tile-${label}`} style={styles.statTile}>
      <ThemedText type="caption" numberOfLines={1}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.statTileValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </SketchSurface>
  );
}

function PerParTile({ label, value }: { label: string; value: number | null }) {
  return (
    <SketchSurface seed={`stats-perpar-${label}`} style={styles.perParTile}>
      <ThemedText type="caption" numberOfLines={1}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.perParValue} numberOfLines={1}>
        {value != null ? value.toFixed(2) : '—'}
      </ThemedText>
    </SketchSurface>
  );
}

const DIST_ROWS: {
  key: keyof LifetimeStats['distribution'];
  label: string;
  color: string;
}[] = [
  { key: 'eagleOrBetter', label: 'Eagle+', color: colors.info },
  { key: 'birdie', label: 'Birdie', color: colors.accent },
  { key: 'par', label: 'Par', color: colors.borderStrong },
  { key: 'bogey', label: 'Bogey', color: colors.warning },
  { key: 'doubleBogey', label: 'Double', color: '#F97316' },
  { key: 'tripleOrWorse', label: 'Triple+', color: colors.danger },
];

function ScoreDistributionBars({
  distribution,
}: {
  distribution: LifetimeStats['distribution'];
}) {
  const max = Math.max(1, ...DIST_ROWS.map((r) => distribution[r.key]));
  return (
    <View style={styles.barList}>
      {DIST_ROWS.map((row) => {
        const count = distribution[row.key];
        const frac = count > 0 ? count / max : 0;
        return (
          <View key={row.key} style={styles.barRow}>
            <ThemedText style={styles.barLabel}>{row.label}</ThemedText>
            <SketchSurface
              seed={`stats-dist-${row.key}`}
              radius={7}
              fill={colors.surfaceAlt}
              style={styles.barTrack}>
              <View
                style={{
                  flex: frac,
                  backgroundColor: count > 0 ? row.color : 'transparent',
                  minWidth: count > 0 ? 6 : 0,
                  height: '100%',
                }}
              />
              <View style={{ flex: Math.max(0, 1 - frac) }} />
            </SketchSurface>
            <ThemedText type="muted" style={styles.barCount}>
              {count}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

type SplitRow = { key: string; label: string; success: number; total: number };

// Shared by "Approach distances" (success = green hit) and "Putting by
// distance" (success = made). Each bar fills the full track, split green
// (success) → red (miss); the right label reads `% (success/total)`.
function SplitDistanceBars({
  rows,
  successLabel,
  failLabel,
  emptyText,
  seedPrefix,
}: {
  rows: SplitRow[];
  successLabel: string;
  failLabel: string;
  emptyText: string;
  seedPrefix: string;
}) {
  if (rows.every((r) => r.total === 0)) {
    return <ThemedText type="muted">{emptyText}</ThemedText>;
  }
  return (
    <View style={styles.barList}>
      {rows.map((r) => {
        const missed = r.total - r.success;
        const successFrac = r.total > 0 ? r.success / r.total : 0;
        const missFrac = r.total > 0 ? missed / r.total : 0;
        return (
          <View key={r.key} style={styles.barRow}>
            <ThemedText style={styles.barLabel}>{r.label}</ThemedText>
            <SketchSurface
              seed={`stats-${seedPrefix}-${r.key}`}
              radius={7}
              fill={colors.surfaceAlt}
              style={styles.barTrack}>
              <View
                style={{
                  flex: successFrac,
                  backgroundColor: colors.accent,
                  minWidth: r.success > 0 ? 6 : 0,
                  height: '100%',
                }}
              />
              <View
                style={{
                  flex: missFrac,
                  backgroundColor: colors.danger,
                  minWidth: missed > 0 ? 6 : 0,
                  height: '100%',
                }}
              />
              <View style={{ flex: Math.max(0, 1 - successFrac - missFrac) }} />
            </SketchSurface>
            <ThemedText type="muted" style={styles.splitCounts}>
              {r.total > 0 ? `${Math.round(successFrac * 100)}% (${r.success}/${r.total})` : '—'}
            </ThemedText>
          </View>
        );
      })}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.accent }]} />
          <ThemedText type="caption">{successLabel}</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.danger }]} />
          <ThemedText type="caption">{failLabel}</ThemedText>
        </View>
      </View>
    </View>
  );
}

function ReviewInsightsCard({ review }: { review: ReturnType<typeof aggregateReview> }) {
  const rows: { question: string; answer: string | null; emphasis?: boolean }[] = [
    {
      question: 'Most often costs you strokes',
      answer: review.topMostCostly
        ? `${review.topMostCostly.label} (${review.topMostCostly.count}×)`
        : null,
    },
    {
      question: 'Most common miss',
      answer: review.topCommonMiss
        ? `${review.topCommonMiss.label} (${review.topCommonMiss.count}×)`
        : null,
    },
    {
      question: 'Most-cited range focus',
      answer: review.topRangeFocus
        ? `${review.topRangeFocus.label} (${review.topRangeFocus.count}×)`
        : null,
    },
    {
      question: 'Avg decision making',
      answer: review.avgDecision != null ? `${review.avgDecision.toFixed(1)}/10` : null,
      emphasis: true,
    },
    {
      question: 'Avg round rating',
      answer: review.avgOverall != null ? `${review.avgOverall.toFixed(1)}/10` : null,
      emphasis: true,
    },
  ];
  return (
    <SketchSurface seed="stats-review" style={styles.reviewCard}>
      {rows.map((row, i) => (
        <View
          key={row.question}
          style={[styles.reviewRow, i < rows.length - 1 && styles.reviewRowDivider]}>
          <ThemedText style={styles.reviewQuestion}>{row.question}</ThemedText>
          <ThemedText
            style={[
              styles.reviewAnswer,
              row.answer == null && styles.reviewAnswerEmpty,
              row.emphasis && styles.reviewAnswerRating,
            ]}
            numberOfLines={1}>
            {row.answer ?? '—'}
          </ThemedText>
        </View>
      ))}
    </SketchSurface>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <SketchSurface seed="stats-empty" style={styles.emptyCard}>
      <ThemedText type="subtitle" style={styles.centerText}>
        {hasAny ? 'No rounds match this filter' : 'No completed rounds yet'}
      </ThemedText>
      <ThemedText type="muted" style={styles.centerText}>
        {hasAny
          ? 'Try a different hole-count or widen the range.'
          : 'Finish a round through its post-round review and your stats will start building here.'}
      </ThemedText>
    </SketchSurface>
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

const styles = StyleSheet.create({
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
  devBar: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  devBtn: {
    flex: 1,
  },
  devSurface: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  devSeedLabel: {
    fontFamily: fontFamily.serif,
    fontSize: 14,
    color: colors.accentOn,
  },
  devClearLabel: {
    fontFamily: fontFamily.serif,
    fontSize: 14,
    color: colors.textSecondary,
  },
  sampleLine: {
    marginTop: -spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  scoringCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  scoringCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  scoringDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.borderStrong,
    marginVertical: spacing.xs,
  },
  bigScore: {
    fontFamily: fontFamily.serifBold,
    fontSize: 34,
    color: colors.textPrimary,
    lineHeight: 38,
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
    fontFamily: fontFamily.serifBold,
    fontSize: 30,
    lineHeight: 32,
    color: colors.accent,
  },
  bestScoreSuffix: {
    fontFamily: fontFamily.sans,
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
    fontFamily: fontFamily.sans,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    color: colors.accent,
  },
  bestCourse: {
    fontFamily: fontFamily.serif,
    fontSize: 16,
    color: colors.textPrimary,
  },
  perParRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  perParTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  perParValue: {
    fontFamily: fontFamily.serifBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  statGrid: {
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 4,
    alignItems: 'center',
  },
  statTileValue: {
    fontFamily: fontFamily.serifBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  trendCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 16,
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
    fontFamily: fontFamily.serif,
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
  splitCounts: {
    width: 92,
    textAlign: 'right',
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  targetWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  reviewCard: {
    paddingHorizontal: spacing.xs,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  reviewRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reviewQuestion: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
  },
  reviewAnswer: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  reviewAnswerEmpty: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  reviewAnswerRating: {
    color: colors.accent,
  },
  emptyCard: {
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
  },
});
