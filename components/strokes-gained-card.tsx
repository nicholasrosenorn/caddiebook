import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { sgBarColor } from '@/components/sg-bar-chart';
import { SgDistanceBars } from '@/components/sg-distance-bars';
import { SketchDivider } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import {
  formatSG,
  SG_BASELINES,
  sgPer18,
  sgVsBaseline,
  type RoundStrokesGained,
} from '@/lib/strokes-gained';

// The strokes-gained card: a player's SG (per 18) measured against one baseline
// at a time — the PGA Tour (raw SG) or a handicap scenario picked from a dropdown.
// A horizontal diverging chart breaks it into the four categories, matching the
// rest of the stats screen. Used on the round summary and the Stats tab.

const CATEGORY_BARS: { key: keyof ReturnType<typeof sgVsBaseline>; label: string }[] = [
  { key: 'ott', label: 'Off the tee' },
  { key: 'approach', label: 'Approach' },
  { key: 'aroundGreen', label: 'Short game' },
  { key: 'putting', label: 'Putting' },
];

const BASELINE_OPTIONS: DropdownOption<string>[] = SG_BASELINES.map((b) => ({
  value: b.key,
  label: b.label,
  short: `compared to ${b.label}`,
}));

export function StrokesGainedCard({
  sg,
  baselineKey: controlledKey,
  onBaselineChange,
}: {
  sg: RoundStrokesGained;
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
  const bars = CATEGORY_BARS.map((c) => ({
    key: c.key,
    label: c.label,
    value: compared[c.key],
  }));

  return (
    <View style={styles.wrap}>
      {/* Baseline picker — compare against the Tour or a handicap scenario */}
      <DropdownSelect
        seed="sg-baseline"
        value={baselineKey}
        options={BASELINE_OPTIONS}
        onChange={setBaselineKey}
      />

      {/* Headline total, reflecting the selected baseline — a labelled row that
          reads as the sum of the breakdown below it, not a floating box. */}
      <View style={styles.totalRow}>
        <View style={styles.totalLabelCol}>
          <ThemedText type="caption">SG TOTAL</ThemedText>
          <ThemedText type="muted">vs {baseline.label}</ThemedText>
        </View>
        <ThemedText style={[styles.totalValue, { color: sgBarColor(compared.total, colors) }]}>
          {formatSG(compared.total)}
        </ThemedText>
      </View>

      <SketchDivider seed="sg-total-rule" />

      {/* Category breakdown — horizontal diverging bars, matching the rest of the
          stats screen. */}
      <SgDistanceBars rows={bars} />

      <ThemedText type="muted" style={styles.footnote}>
        Positive = strokes gained. Off-the-tee &amp; short game are estimated.
      </ThemedText>
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
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    totalLabelCol: {
      gap: 2,
    },
    totalValue: {
      fontFamily: fonts.serifBold,
      fontSize: 32,
      lineHeight: 36,
    },
    footnote: {
      fontSize: 12,
      textAlign: 'center',
    },
  });
