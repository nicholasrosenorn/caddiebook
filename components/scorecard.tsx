import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScoreGlyph, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import type { Hole } from '@/db/types';
import { resolveGir, scoreIndicator } from '@/lib/stats';

const CELL_H = 30;
const LABEL_W = 42;
const TOTAL_W = 36;
const GLYPH = 26;

// Row order for a column-first scorecard. Striped rows get a faint wash so the
// horizontal lanes read across the nine.
const ROWS = [
  { key: 'hole', label: 'HOLE' },
  { key: 'par', label: 'PAR' },
  { key: 'score', label: 'SCORE' },
  { key: 'putt', label: 'PUTT' },
  { key: 'fir', label: 'FIR' },
  { key: 'gir', label: 'GIR' },
] as const;

const striped = (i: number) => i % 2 === 1;

type Props = {
  holes: Hole[];
  onPressHole?: (holeNumber: number) => void;
};

export function Scorecard({ holes, onPressHole }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const sorted = [...holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const front = sorted.filter((h) => h.holeNumber <= 9);
  const back = sorted.filter((h) => h.holeNumber > 9);

  return (
    <View style={styles.wrap}>
      <Nine seed="sc-front" holes={front} totalLabel="OUT" onPressHole={onPressHole} />
      {back.length > 0 && (
        <Nine seed="sc-back" holes={back} totalLabel="IN" onPressHole={onPressHole} />
      )}
    </View>
  );
}

function Nine({
  seed,
  holes,
  totalLabel,
  onPressHole,
}: {
  seed: string;
  holes: Hole[];
  totalLabel: string;
  onPressHole?: (holeNumber: number) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const totals = {
    par: sum(holes.map((h) => h.par)),
    score: sum(holes.map((h) => h.score)),
    putt: sum(holes.map((h) => h.putts)),
    fir: holes.filter((h) => h.fir === true).length,
    gir: holes.filter((h) => resolveGir(h) === true).length,
  };

  return (
    <SketchSurface seed={seed} style={styles.card}>
      <View style={styles.grid}>
        <LabelColumn />
        {holes.map((h) => (
          <HoleColumn key={h.holeNumber} hole={h} onPress={onPressHole} />
        ))}
        <TotalColumn totalLabel={totalLabel} totals={totals} />
      </View>
    </SketchSurface>
  );
}

function LabelColumn() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.col, styles.labelCol]}>
      {ROWS.map((row, i) => (
        <View
          key={row.key}
          style={[styles.cell, striped(i) && styles.cellStriped]}>
          <ThemedText type="caption" style={styles.labelText} numberOfLines={1}>
            {row.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function HoleColumn({
  hole,
  onPress,
}: {
  hole: Hole;
  onPress?: (holeNumber: number) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPar3 = hole.par === 3;
  const gir = resolveGir(hole);
  return (
    <Pressable
      onPress={onPress ? () => onPress(hole.holeNumber) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Edit hole ${hole.holeNumber}`}
      style={({ pressed }) => [styles.col, styles.holeCol, pressed && styles.colPressed]}>
      <Cell rowIndex={0}>
        <ThemedText style={styles.numText}>{hole.holeNumber}</ThemedText>
      </Cell>
      <Cell rowIndex={1}>
        <ThemedText style={styles.numMuted}>{hole.par ?? '–'}</ThemedText>
      </Cell>
      <Cell rowIndex={2}>
        <ScoreCellContent score={hole.score} par={hole.par} />
      </Cell>
      <Cell rowIndex={3}>
        <ThemedText style={styles.numText}>{hole.putts ?? '–'}</ThemedText>
      </Cell>
      <Cell rowIndex={4}>
        <Mark value={isPar3 ? null : hole.fir} />
      </Cell>
      <Cell rowIndex={5}>
        <Mark value={gir} />
      </Cell>
    </Pressable>
  );
}

function TotalColumn({
  totalLabel,
  totals,
}: {
  totalLabel: string;
  totals: { par: number | null; score: number | null; putt: number | null; fir: number; gir: number };
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.col, styles.totalCol]}>
      <Cell rowIndex={0}>
        <ThemedText type="caption" style={styles.totalLabelText}>
          {totalLabel}
        </ThemedText>
      </Cell>
      <Cell rowIndex={1}>
        <ThemedText style={styles.numMuted}>{totals.par ?? '–'}</ThemedText>
      </Cell>
      <Cell rowIndex={2}>
        <ThemedText style={styles.numStrong}>{totals.score ?? '–'}</ThemedText>
      </Cell>
      <Cell rowIndex={3}>
        <ThemedText style={styles.numText}>{totals.putt ?? '–'}</ThemedText>
      </Cell>
      <Cell rowIndex={4}>
        <ThemedText style={styles.numMuted}>{totals.fir}</ThemedText>
      </Cell>
      <Cell rowIndex={5}>
        <ThemedText style={styles.numMuted}>{totals.gir}</ThemedText>
      </Cell>
    </View>
  );
}

function Cell({ rowIndex, children }: { rowIndex: number; children: React.ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.cell, striped(rowIndex) && styles.cellStriped]}>{children}</View>
  );
}

function ScoreCellContent({ score, par }: { score: number | null; par: number | null }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (score == null) return <ThemedText style={styles.numMuted}>–</ThemedText>;
  const indicator = par != null ? scoreIndicator(score, par) : 'none';
  const hasGlyph = indicator !== 'none' && indicator !== 'par';
  return (
    <View style={styles.scoreCell}>
      {hasGlyph && (
        <View style={styles.glyphCenter} pointerEvents="none">
          <ScoreGlyph kind={indicator} size={GLYPH} color={colors.borderStrong} />
        </View>
      )}
      <ThemedText style={styles.numText}>{score}</ThemedText>
    </View>
  );
}

function Mark({ value }: { value: boolean | null }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (value == null) return <ThemedText style={styles.numMuted}>–</ThemedText>;
  return (
    <IconSymbol
      name={value ? 'checkmark' : 'xmark'}
      size={13}
      color={value ? colors.accent : colors.textMuted}
    />
  );
}

function sum(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    card: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    grid: {
      flexDirection: 'row',
    },
    col: {
      // hole columns flex to share the remaining width
    },
    labelCol: {
      width: LABEL_W,
    },
    holeCol: {
      flex: 1,
      minWidth: 0,
    },
    totalCol: {
      width: TOTAL_W,
    },
    colPressed: {
      backgroundColor: colors.accentMuted,
      borderRadius: 4,
    },
    cell: {
      height: CELL_H,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellStriped: {
      backgroundColor: colors.surfaceAlt,
    },
    labelText: {
      fontSize: 9,
      letterSpacing: 0.5,
    },
    totalLabelText: {
      fontSize: 9,
      letterSpacing: 0.5,
    },
    numText: {
      fontFamily: fontFamily.serif,
      fontSize: 14,
      color: colors.textPrimary,
    },
    numMuted: {
      fontFamily: fontFamily.serif,
      fontSize: 14,
      color: colors.textSecondary,
    },
    numStrong: {
      fontFamily: fontFamily.serifBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    scoreCell: {
      width: GLYPH,
      height: CELL_H,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glyphCenter: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
