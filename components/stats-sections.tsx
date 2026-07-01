import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { DeltaBadge } from '@/components/delta-badge';
import { FiguresRow } from '@/components/figures-row';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import {
  formatDelta,
  formatToPar,
  type HoleCountFilter,
  type LifetimeStats,
  type ReviewInsights,
  type RoundDerived,
} from '@/lib/lifetime-stats';

// The shared deep-stats vocabulary — the section hero, the trend card, the best
// round callout, the mental-game breakdowns, and the scoring figures. Lifted out
// of the old progress-view so the deep stats page, the me-tab summary, and the
// onboarding tour all read from one source.

export function formatAvg(value: number | null): string {
  return value != null ? value.toFixed(2) : '—';
}

export function formatDate(iso: string): string {
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * The editorial hero atop each deep-stats section: a stamped caption, the big
 * headline numeral (with an optional small suffix), a directional delta, and the
 * windowed sparkline beneath. The numeral + sparkline carry the section; the
 * detail figures sit below.
 */
export function SectionHero({
  caption,
  value,
  suffix,
  delta,
  deltaLowerIsBetter = false,
  deltaFormat = formatDelta,
  points,
  baseline,
  baselineLabel,
  formatValue,
  trendLabel,
  footer,
}: {
  caption: string;
  value: string;
  suffix?: string;
  delta: number | null;
  deltaLowerIsBetter?: boolean;
  deltaFormat?: (n: number) => string;
  points: number[];
  baseline?: number;
  baselineLabel?: string;
  formatValue?: (n: number) => string;
  /** Caption under the sparkline (e.g. "FIR % · last 20"). */
  trendLabel?: string;
  /** Optional element under the value row, left of the sparkline (e.g. "+7.3 to par"). */
  footer?: ReactNode;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.heroBody}>
      <ThemedText type="caption" style={styles.heroCaption}>
        {caption.toUpperCase()}
      </ThemedText>
      <View style={styles.heroValueRow}>
        <View style={styles.heroValueLockup}>
          <ThemedText style={styles.heroValue} numberOfLines={1}>
            {value}
            {suffix ? <ThemedText style={styles.heroSuffix}>{suffix}</ThemedText> : null}
          </ThemedText>
          {footer}
        </View>
        <DeltaBadge delta={delta} lowerIsBetter={deltaLowerIsBetter} format={deltaFormat} />
      </View>
      {points.length >= 2 ? (
        <>
          <TrendChart
            points={points}
            height={72}
            baseline={baseline}
            baselineLabel={baselineLabel}
            formatValue={formatValue}
          />
          {trendLabel ? (
            <ThemedText type="caption" style={styles.heroCaption}>
              {trendLabel.toUpperCase()}
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

// The filtered scoring figures (a real scoring average for a single hole count,
// fair per-18 to-par when the set mixes lengths).
export function ScoringFigures({
  stats,
  holeFilter,
}: {
  stats: LifetimeStats;
  holeFilter: HoleCountFilter;
}) {
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
    <FiguresRow
      size="md"
      boxed
      seed="scoring-figs"
      figures={[
        { label: primaryLabel, value: primaryValue },
        { label: single ? 'To par' : 'To par / round', value: secondaryValue },
      ]}
    />
  );
}

export function BestRoundCallout({ best, uniform }: { best: RoundDerived; uniform: boolean }) {
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

export function TrendCard({
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
      <View style={styles.sectionBody}>
        <ThemedText type="caption">
          {review.count} {review.count === 1 ? 'REVIEW' : 'REVIEWS'}
        </ThemedText>

        <FiguresRow
          size="md"
          boxed
          seed="mental-figs"
          figures={[
            {
              label: 'Decision Making AVG',
              value: review.avgDecision != null ? `${review.avgDecision.toFixed(1)}/10` : '—',
            },
            {
              label: 'Round Rating AVG',
              value: review.avgOverall != null ? `${review.avgOverall.toFixed(1)}/10` : '—',
            },
          ]}
        />

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

// Single-accent count bars for a categorical review breakdown. Renders nothing
// when there's no data for the field.
export function FrequencyBars<T extends string>({
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

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    heroBody: {
      gap: spacing.sm,
    },
    heroCaption: {
      color: colors.textMuted,
    },
    heroValueRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    heroValueLockup: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    heroValue: {
      fontFamily: fonts.serifBold,
      fontSize: 52,
      lineHeight: 56,
      letterSpacing: -0.5,
      color: colors.textPrimary,
    },
    heroSuffix: {
      fontFamily: fonts.serif,
      fontSize: 26,
      color: colors.textMuted,
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
