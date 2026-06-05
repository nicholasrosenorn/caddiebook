import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { InfoHint } from '@/components/info-hint';
import { ScoreGrid } from '@/components/score-grid';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { updateHole } from '@/db/queries';
import type { Hole } from '@/db/types';

type Props = {
  roundId: string;
  hole: Hole;
  onChange: () => void | Promise<void>;
  onPicked?: () => void;
};

export function ScorePage({ roundId, hole, onChange, onPicked }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const handlePick = async (score: number | null) => {
    try {
      await updateHole(roundId, hole.holeNumber, { score });
      await onChange();
      // Only auto-advance when a score is actually set (tap-again clears to null).
      if (score != null) onPicked?.();
    } catch (err) {
      console.error(err);
    }
  };

  const nextLabel = hole.par === 3 ? 'approach' : 'drive';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Enter score</ThemedText>
      </View>

      <ScoreGrid par={hole.par} value={hole.score} onChange={handlePick} />

      <View style={styles.hintRow}>
        <InfoHint
          title="Logging the score"
          message="Tap your strokes for this hole. Swipe up to move between the pages of a hole."
        />
        <ThemedText type="muted" style={styles.hint}>
          {hole.score != null
            ? `${hole.score} ${hole.score === 1 ? 'stroke' : 'strokes'} · swipe up for ${nextLabel}`
            : 'Tap to set score'}
        </ThemedText>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: 100,
      justifyContent: 'center',
      gap: spacing.xl,
    },
    header: {
      alignItems: 'center',
      gap: 4,
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    hint: {
      flexShrink: 1,
      textAlign: 'center',
      color: colors.textMuted,
    },
  });
