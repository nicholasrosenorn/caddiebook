import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { ScoreDistribution } from '@/lib/stats';

// The shared editorial stats vocabulary — one source of truth for the me-tab
// progress view, the round summary, and the community round summary so every
// stats surface reads consistently.

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function StatTile({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
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

// A single-ink emphasis ramp: the rarest, best scores get the strongest ink;
// the everyday ones fade toward the page. Tints floor at 25% alpha so the ramp
// stays legible on dark themes; Triple+ falls off into the muted neutral (the
// same "miss" tone the split bars use) so it doesn't vanish at tiny widths.
export function ScoreDistributionBars({
  distribution,
  empty,
}: {
  distribution: ScoreDistribution;
  empty?: boolean;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const DIST_ROWS: {
    key: keyof ScoreDistribution;
    label: string;
    color: string;
  }[] = [
    { key: 'eagleOrBetter', label: 'Eagle+', color: colors.accentPressed },
    { key: 'birdie', label: 'Birdie', color: colors.accent },
    { key: 'par', label: 'Par', color: `${colors.accent}B3` },
    { key: 'bogey', label: 'Bogey', color: `${colors.accent}73` },
    { key: 'doubleBogey', label: 'Double', color: `${colors.accent}40` },
    { key: 'tripleOrWorse', label: 'Triple+', color: colors.borderStrong },
  ];
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
              {empty ? '—' : count}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

export type SplitRow = { key: string; label: string; success: number; total: number };

// Shared by "Approach distances" (success = green hit) and "Putting by
// distance" (success = made). Each bar fills the full track, split ink
// (success) → muted neutral (miss); the right label reads `% (success/total)`.
export function SplitDistanceBars({
  rows,
  successLabel,
  failLabel,
  seedPrefix,
}: {
  rows: SplitRow[];
  successLabel: string;
  failLabel: string;
  seedPrefix: string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
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
                  backgroundColor: colors.borderStrong,
                  minWidth: missed > 0 ? 6 : 0,
                  height: '100%',
                }}
              />
              <View style={{ flex: Math.max(0, 1 - successFrac - missFrac) }} />
            </SketchSurface>
            <View style={styles.splitCounts}>
              {r.total > 0 ? (
                <>
                  <ThemedText style={styles.splitPct} numberOfLines={1}>
                    {Math.round(successFrac * 100)}%
                  </ThemedText>
                  <ThemedText type="muted" style={styles.splitFraction} numberOfLines={1}>
                    {r.success}/{r.total}
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="muted" style={styles.splitPct}>
                  —
                </ThemedText>
              )}
            </View>
          </View>
        );
      })}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.accent }]} />
          <ThemedText type="caption">{successLabel}</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, { backgroundColor: colors.borderStrong }]} />
          <ThemedText type="caption">{failLabel}</ThemedText>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    section: {
      gap: spacing.md,
    },
    sectionBody: {
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
      fontSize: 20,
      lineHeight: 27,
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
    splitCounts: {
      width: 72,
      alignItems: 'flex-end',
    },
    splitPct: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textPrimary,
    },
    splitFraction: {
      fontSize: 12,
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
  });
