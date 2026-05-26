import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ClubChips } from '@/components/club-chips';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { InfoHint } from '@/components/info-hint';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS, sortByDriveLength } from '@/constants/clubs';
import { radius, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { getBag, updateHole, upsertShot } from '@/db/queries';
import type { Hole, Shot } from '@/db/types';
import { driverLane, isFairwayHit } from '@/lib/shots';

type Position = { xNorm: number; yNorm: number };

type Props = {
  roundId: string;
  hole: Hole;
  shotsForRound: Shot[];
  onChange: () => void | Promise<void>;
};

export function DrivePage({ roundId, hole, shotsForRound, onChange }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const targetWidth = Math.min(300, screenWidth - 60);
  const targetHeight = Math.min(500, screenHeight * 0.56);

  const [position, setPosition] = useState<Position | null>(null);
  const [bag, setBag] = useState<readonly string[]>(() => sortByDriveLength(CLUB_OPTIONS));

  // Reload on focus so bag edits made elsewhere are reflected on return.
  useFocusEffect(
    useCallback(() => {
      getBag().then((clubs) =>
        setBag(sortByDriveLength(clubs.length > 0 ? clubs : CLUB_OPTIONS)),
      );
    }, []),
  );

  useEffect(() => {
    const drive = shotsForRound.find(
      (s) => s.holeNumber === hole.holeNumber && s.shotType === 'driver',
    );
    setPosition(drive ? { xNorm: drive.xNorm, yNorm: drive.yNorm } : null);
  }, [shotsForRound, hole.holeNumber]);

  const handleTap = async (x: number, y: number) => {
    setPosition({ xNorm: x, yNorm: y });
    try {
      await upsertShot({
        roundId,
        holeNumber: hole.holeNumber,
        shotType: 'driver',
        xNorm: x,
        yNorm: y,
      });
      const lane = driverLane(x, y);
      await updateHole(roundId, hole.holeNumber, { fir: isFairwayHit(lane) });
      await onChange();
    } catch (err) {
      console.error(err);
      Alert.alert('Save failed', 'Could not save drive.');
    }
  };

  const onClubChange = async (club: string | null) => {
    try {
      await updateHole(roundId, hole.holeNumber, { driveClub: club });
      await onChange();
    } catch (err) {
      console.error(err);
    }
  };

  const otherDrives: TargetPin[] = shotsForRound
    .filter((s) => s.shotType === 'driver' && s.holeNumber !== hole.holeNumber)
    .map((s) => ({ key: s.id, xNorm: s.xNorm, yNorm: s.yNorm, variant: 'muted' }));

  const pins: TargetPin[] = position
    ? [...otherDrives, { xNorm: position.xNorm, yNorm: position.yNorm, key: 'current' }]
    : otherDrives;

  const isFir = position != null && driverLane(position.xNorm, position.yNorm) === 'CF';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="caption">DRIVE</ThemedText>
      </View>
      <View style={styles.targetWrap}>
        <DriverTarget
          pins={pins}
          onTap={handleTap}
          width={targetWidth}
          height={targetHeight}
        />
      </View>
      {position ? (
        <View style={[styles.badge, isFir && styles.badgePositive]}>
          <ThemedText style={[styles.badgeText, isFir && styles.badgeTextPositive]}>
            {formatDriverResult(position.xNorm, position.yNorm)}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.hintRow}>
          <InfoHint
            title="Marking your drive"
            message="Tap the fairway oval where your drive came to rest. Left, center, or right lane sets the line; the center lane counts as a fairway hit (FIR). Tap again to move it. The club chips below record what you hit."
          />
          <ThemedText type="muted" style={styles.hint}>
            Tap fairway to mark where your drive landed.
          </ThemedText>
        </View>
      )}
      <View style={styles.form}>
        <View style={styles.formField}>
          <ThemedText type="caption">CLUB</ThemedText>
          <ClubChips value={hole.driveClub} onChange={onClubChange} clubs={bag} />
        </View>
      </View>
    </View>
  );
}

function formatDriverResult(xNorm: number, yNorm: number): string {
  const lane = driverLane(xNorm, yNorm);
  if (lane === 'CF') return 'Center fairway · FIR ✓';
  if (lane === 'LF') return 'Left of fairway';
  return 'Right of fairway';
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.md,
  },
  targetWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: spacing.md,                                                          
    marginVertical: spacing.sm, 
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
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    marginVertical: spacing.sm,
  },
  hint: {
    flexShrink: 1,
    textAlign: 'center',
    color: colors.textMuted,
  },
  form: {
    gap: spacing.md,
  },
  formField: {
    gap: spacing.xs,
  },
});
