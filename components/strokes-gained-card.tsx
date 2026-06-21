import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { SgBarChart, type SgBar } from '@/components/sg-bar-chart';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { TrendChart } from '@/components/trend-chart';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import {
  benchmarkSG,
  formatSG,
  SG_BASELINES,
  sgPer18,
  sgVsBaseline,
  type RoundStrokesGained,
} from '@/lib/strokes-gained';

// The strokes-gained card: a player's SG (per 18) measured against one baseline
// at a time — the PGA Tour (raw SG) or a handicap scenario picked from a dropdown.
// A column chart breaks it into the four categories; the total and the over-time
// trend reflect the same baseline. Used on the round summary and the Stats tab.

const CATEGORY_BARS: { key: keyof ReturnType<typeof sgVsBaseline>; label: string }[] = [
  { key: 'ott', label: 'TEE' },
  { key: 'approach', label: 'APPR' },
  { key: 'aroundGreen', label: 'SHORT' },
  { key: 'putting', label: 'PUTT' },
];

const BASELINE_OPTIONS: DropdownOption<string>[] = SG_BASELINES.map((b) => ({
  value: b.key,
  label: b.label,
  short: `compared to ${b.label}`,
}));

export function StrokesGainedCard({
  sg,
  trend,
  baselineKey: controlledKey,
  onBaselineChange,
}: {
  sg: RoundStrokesGained;
  /** Chronological per-round total SG (per 18, vs Tour); renders a trend when ≥ 2. */
  trend?: number[];
  /** Controlled baseline selection — when set, the parent owns the dropdown so
   *  sibling charts (the distance-band bars) can follow it. Else self-managed. */
  baselineKey?: string;
  onBaselineChange?: (key: string) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [internalKey, setInternalKey] = useState('10');
  const baselineKey = controlledKey ?? internalKey;
  const setBaselineKey = onBaselineChange ?? setInternalKey;

  const per18 = sgPer18(sg);
  if (!per18) {
    return (
      <ThemedText type="muted" style={styles.centerText}>
        Log approach distances and putts to unlock strokes gained.
      </ThemedText>
    );
  }

  const baseline = SG_BASELINES.find((b) => b.key === baselineKey) ?? SG_BASELINES[0];
  const compared = sgVsBaseline(per18, baseline.hcp);
  const bars: SgBar[] = CATEGORY_BARS.map((c) => ({
    key: c.key,
    label: c.label,
    value: compared[c.key],
  }));

  // The trend is stored vs Tour; shift it by the selected baseline so the 0-line
  // means "even with that golfer".
  const totalBenchmark = baseline.hcp == null ? 0 : benchmarkSG('total', baseline.hcp);
  const trendVsBaseline = trend?.map((p) => p - totalBenchmark);
  const baselineLabel = baseline.key === 'tour' ? 'tour' : baseline.label;

  return (
    <View style={styles.wrap}>
      {/* Baseline picker — compare against the Tour or a handicap scenario */}
      <DropdownSelect
        seed="sg-baseline"
        value={baselineKey}
        options={BASELINE_OPTIONS}
        onChange={setBaselineKey}
      />

      {/* Total, reflecting the selected baseline — boxed like the other primary
          numbers (score / to-par / handicap cards). */}
      <SketchSurface seed="sg-total" style={styles.totalCard}>
        <ThemedText type="caption">SG TOTAL · PER 18</ThemedText>
        <ThemedText style={styles.totalValue}>{formatSG(compared.total)}</ThemedText>
        <ThemedText type="muted">vs {baseline.label}</ThemedText>
      </SketchSurface>

      {/* Category breakdown */}
      <SgBarChart bars={bars} />

      <ThemedText type="muted" style={styles.footnote}>
        Positive = strokes gained. Off-the-tee &amp; short game are estimated.
      </ThemedText>

      {trendVsBaseline && trendVsBaseline.length >= 2 ? (
        <View style={styles.trendBlock}>
          <ThemedText type="caption">
            SG TOTAL OVER TIME · PER 18 · VS {baseline.label.toUpperCase()}
          </ThemedText>
          <TrendChart
            points={trendVsBaseline}
            baseline={0}
            baselineLabel={baselineLabel}
            formatValue={(n) => formatSG(n)}
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.md,
    },
    centerText: {
      textAlign: 'center',
    },
    totalCard: {
      alignItems: 'center',
      gap: 2,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    totalValue: {
      fontFamily: fonts.serifBold,
      fontSize: 34,
      lineHeight: 40,
      color: colors.textPrimary,
    },
    footnote: {
      fontSize: 12,
      textAlign: 'center',
    },
    trendBlock: {
      gap: spacing.sm,
    },
  });
