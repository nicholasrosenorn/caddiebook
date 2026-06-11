import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Scorecard } from '@/components/scorecard';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole, Round } from '@/db/types';
import { computeRoundSummary, formatPct, totalPar } from '@/lib/stats';

type Props = {
  round: Round;
  holes: Hole[];
  // Tap a hole column to jump straight to it in the round flow.
  onPressHole: (holeNumber: number) => void;
};

// In-round scorecard: the live card for both nines plus the round-so-far stat
// tiles that used to sit at the top of the hole Stats page.
export function ScorecardOverlay({ round, holes, onPressHole }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();

  const summary = computeRoundSummary(holes);
  const toPar = summary.holesPlayed > 0 ? summary.totalScore - totalPar(holes) : null;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        // Clear the floating header buttons / home indicator.
        { paddingTop: insets.top + 56, paddingBottom: insets.bottom + spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <ThemedText type="caption">
          {formatDate(round.datePlayed).toUpperCase()}
        </ThemedText>
        <ThemedText type="title">{round.courseName}</ThemedText>
      </View>

      <Scorecard holes={holes} onPressHole={onPressHole} />

      <View style={styles.statGrid}>
        <View style={styles.statRow}>
          <StatTile
            label="Score"
            value={summary.holesPlayed > 0 ? String(summary.totalScore) : '—'}
          />
          <StatTile label="To Par" value={toPar == null ? '—' : formatToPar(toPar)} />
          <StatTile
            label="Putts"
            value={summary.totalPutts > 0 ? String(summary.totalPutts) : '—'}
          />
        </View>
        <View style={styles.statRow}>
          <StatTile label="GIR" value={formatPct(summary.girPct)} />
          <StatTile label="FIR" value={formatPct(summary.firPct)} />
          <StatTile label="U&D" value={formatPct(summary.udPct)} />
        </View>
      </View>
    </ScrollView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <SketchSurface seed={`card-stat-${label}`} style={styles.statTile}>
      <ThemedText type="caption" numberOfLines={1}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.statTileValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </SketchSurface>
  );
}

function formatToPar(toPar: number): string {
  if (toPar === 0) return 'E';
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

function formatDate(iso: string): string {
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: spacing.md,
      gap: spacing.lg,
    },
    header: {
      alignItems: 'center',
      gap: 2,
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
      fontFamily: fonts.serifBold,
      fontSize: 22,
      lineHeight: 30,
      color: colors.textPrimary,
    },
    hint: {
      textAlign: 'center',
    },
  });
