import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BinaryChoice } from '@/components/binary-choice';
import { OptionRow } from '@/components/option-row';
import { ScoreGrid } from '@/components/score-grid';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole } from '@/lib/data/models';
import { useUpdateHole } from '@/lib/data/rounds';
import { deriveGir, resolveGir, resolveUpAndDown } from '@/lib/stats';

type HoleField = keyof Omit<Hole, 'id' | 'roundId' | 'holeNumber'>;

type Props = {
  roundId: string;
  hole: Hole;
};

export function HoleStatsPage({ roundId, hole }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const updateHole = useUpdateHole();

  const update = async <K extends HoleField>(field: K, value: Hole[K]) => {
    try {
      await updateHole(roundId, hole.holeNumber, { [field]: value });
    } catch (err) {
      console.error(err);
    }
  };

  const showFir = hole.par == null || hole.par >= 4;
  const blocked = hole.greenBlocked === true;
  const derivedGir = deriveGir(hole.par, hole.score, hole.putts);
  const resolvedGir = resolveGir(hole);
  const girIsAuto = hole.gir == null;
  // Blocked greens (no realistic shot at the green) are excluded from U&D too.
  const showUd = resolvedGir === false;
  const resolvedUd = resolveUpAndDown(hole);
  const udIsAuto = hole.upAndDown == null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.headerBlock}>
        <ThemedText type="caption">STATS</ThemedText>
        <ThemedText type="title">
          Hole {hole.holeNumber}
          {hole.par != null ? ` · Par ${hole.par}` : ''}
        </ThemedText>
      </View>

      <ScoreGrid
        par={hole.par}
        value={hole.score}
        onChange={(v) => update('score', v)}
      />

      <OptionRow
        label="Putts"
        value={hole.putts}
        onChange={(v) => update('putts', v)}
      />

      {showFir && (
        <BinaryChoice
          label="Fairway Hit (FIR)"
          value={hole.fir}
          onChange={(v) => update('fir', v)}
        />
      )}

      {blocked ? (
        <View style={styles.girStatus}>
          <ThemedText style={styles.girStatusLabel}>Green in Regulation (GIR)</ThemedText>
          <SketchSurface
            seed="gir-blocked"
            fill={colors.surfaceAlt}
            stroke={colors.borderStrong}
            style={styles.girStatusSurface}>
            <IconSymbol name="info.circle" size={20} color={colors.textMuted} />
            <ThemedText style={styles.girStatusText}>
              Excluded — couldn&apos;t reach the green
            </ThemedText>
          </SketchSurface>
        </View>
      ) : (
        <BinaryChoice
          label="Green in Regulation (GIR)"
          hint={girIsAuto && derivedGir != null ? 'Auto from score − putts' : undefined}
          value={resolvedGir}
          onChange={(v) => update('gir', v)}
        />
      )}

      {showUd && (
        <BinaryChoice
          label="Up & Down"
          hint={udIsAuto && resolvedUd != null ? 'Auto from score ≤ par' : undefined}
          value={resolvedUd}
          onChange={(v) => update('upAndDown', v)}
        />
      )}

      <OptionRow
        label="Chip Shots"
        value={hole.chipShots}
        onChange={(v) => update('chipShots', v)}
      />
      <OptionRow
        label="Greenside Sand"
        value={hole.sandShots}
        onChange={(v) => update('sandShots', v)}
      />
      <OptionRow
        label="Penalties"
        value={hole.penalties}
        onChange={(v) => update('penalties', v)}
      />
    </ScrollView>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingLeft: spacing.md,
    paddingRight: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 140,
    gap: spacing.lg,
  },
  headerBlock: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.sm,
  },
  girStatus: {
    gap: spacing.sm,
  },
  girStatusLabel: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  girStatusSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  girStatusText: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
