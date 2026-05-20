import { useEffect, useState } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ApproachTarget } from '@/components/approach-target';
import { ClubPicker } from '@/components/club-picker';
import type { TargetPin } from '@/components/driver-target';
import { NumericField } from '@/components/numeric-field';
import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';
import { updateHole, upsertShot } from '@/db/queries';
import type { Hole, Shot } from '@/db/types';
import { approachResult } from '@/lib/shots';

type Position = { xNorm: number; yNorm: number };

type Props = {
  roundId: string;
  hole: Hole;
  shotsForRound: Shot[];
  onChange: () => void | Promise<void>;
};

export function ApproachPage({ roundId, hole, shotsForRound, onChange }: Props) {
  const { width, height } = useWindowDimensions();
  const targetSize = Math.min(320, width - 32, height * 0.5);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
    const approach = shotsForRound.find(
      (s) => s.holeNumber === hole.holeNumber && s.shotType === 'approach',
    );
    setPosition(approach ? { xNorm: approach.xNorm, yNorm: approach.yNorm } : null);
  }, [shotsForRound, hole.holeNumber]);

  const handleTap = async (x: number, y: number) => {
    setPosition({ xNorm: x, yNorm: y });
    try {
      await upsertShot({
        roundId,
        holeNumber: hole.holeNumber,
        shotType: 'approach',
        xNorm: x,
        yNorm: y,
      });
      const { onGreen } = approachResult(x, y);
      await updateHole(roundId, hole.holeNumber, { gir: onGreen });
      await onChange();
    } catch (err) {
      console.error(err);
      Alert.alert('Save failed', 'Could not save approach.');
    }
  };

  const onClubChange = async (club: string | null) => {
    try {
      await updateHole(roundId, hole.holeNumber, { approachClub: club });
      await onChange();
    } catch (err) {
      console.error(err);
    }
  };

  const onYardsCommit = async (yards: number | null) => {
    try {
      await updateHole(roundId, hole.holeNumber, { approachDistanceYds: yards });
      await onChange();
    } catch (err) {
      console.error(err);
    }
  };

  const otherApproaches: TargetPin[] = shotsForRound
    .filter((s) => s.shotType === 'approach' && s.holeNumber !== hole.holeNumber)
    .map((s) => ({ key: s.id, xNorm: s.xNorm, yNorm: s.yNorm, variant: 'muted' }));

  const pins: TargetPin[] = position
    ? [...otherApproaches, { xNorm: position.xNorm, yNorm: position.yNorm, key: 'current' }]
    : otherApproaches;

  const result = position ? formatApproachLabel(position.xNorm, position.yNorm) : null;
  const isOnGreen = position != null && approachResult(position.xNorm, position.yNorm).onGreen;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="caption">APPROACH</ThemedText>
        <ThemedText type="title">
          Hole {hole.holeNumber}
          {hole.par != null ? ` · Par ${hole.par}` : ''}
        </ThemedText>
      </View>
      <View style={styles.targetWrap}>
        <ApproachTarget pins={pins} onTap={handleTap} size={targetSize} />
      </View>
      {position ? (
        <View style={[styles.badge, isOnGreen && styles.badgePositive]}>
          <ThemedText style={[styles.badgeText, isOnGreen && styles.badgeTextPositive]}>
            {result}
          </ThemedText>
        </View>
      ) : (
        <ThemedText type="muted" style={styles.hint}>
          Tap to mark where your approach landed.
        </ThemedText>
      )}
      <View style={styles.form}>
        <View style={styles.formField}>
          <ThemedText type="caption">CLUB</ThemedText>
          <ClubPicker value={hole.approachClub} onChange={onClubChange} />
        </View>
        <View style={styles.formField}>
          <ThemedText type="caption">YARDS IN</ThemedText>
          <NumericField
            value={hole.approachDistanceYds}
            onCommit={onYardsCommit}
            min={0}
            max={400}
            placeholder="–"
          />
        </View>
      </View>
    </View>
  );
}

function formatApproachLabel(x: number, y: number): string {
  const r = approachResult(x, y);
  if (!r.onGreen) return 'Off green';
  return `${r.proximityFt} ft from pin (GIR ✓)`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.sm,
  },
  targetWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  hint: {
    textAlign: 'center',
    paddingBottom: spacing.md,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  badgePositive: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  badgeTextPositive: {
    color: colors.accent,
  },
  form: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  formField: {
    flex: 1,
    gap: spacing.xs,
  },
});
