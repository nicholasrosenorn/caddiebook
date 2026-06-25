import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ClubChips } from '@/components/club-chips';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { InfoHint } from '@/components/info-hint';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS, sortByDriveLength } from '@/constants/clubs';
import { radius, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import type { Hole, Shot } from '@/lib/data/models';
import { useUpdateHole, useUpsertShot } from '@/lib/data/rounds';
import { useBag } from '@/lib/data/settings';
import { driveDistanceFromY, driverLane, isFairwayHit } from '@/lib/shots';

type Props = {
  roundId: string;
  hole: Hole;
  shotsForRound: Shot[];
  onComplete?: () => void;
};

export function DrivePage({ roundId, hole, shotsForRound, onComplete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  // Narrower + taller than a square so the fairway reads as a long oval rather
  // than a compressed one.
  const targetWidth = Math.min(275, screenWidth - 96);
  const targetHeight = Math.min(450, screenHeight * 0.52);

  const upsertShot = useUpsertShot();
  const updateHole = useUpdateHole();

  const { bag: storedBag } = useBag();
  const bag = useMemo(
    () => sortByDriveLength(storedBag.length > 0 ? storedBag : CLUB_OPTIONS),
    [storedBag],
  );

  // The drive pin comes straight from the cached shots — the optimistic upsert
  // updates it on the same frame as the tap.
  const drive = shotsForRound.find(
    (s) => s.holeNumber === hole.holeNumber && s.shotType === 'driver',
  );
  const position = drive ? { xNorm: drive.xNorm, yNorm: drive.yNorm } : null;

  // The page is fully logged once pin + club are set — the pin tap also carries
  // the distance (derived from where the ball lands up the fairway).
  const hasClub = hole.driveClub != null && hole.driveClub !== '';

  const handleTap = async (x: number, y: number) => {
    // Advance only on the transition into the complete pair — adjusting an
    // already-placed pin shouldn't yank the page away.
    const wasComplete = position != null && hasClub;
    try {
      // One command: the shot plus the derived fir flag and the distance read
      // off the ball's vertical position, atomic server-side.
      await upsertShot({
        roundId,
        holeNumber: hole.holeNumber,
        shotType: 'driver',
        xNorm: x,
        yNorm: y,
        holePatch: { fir: isFairwayHit(driverLane(x, y)), driveDistanceYds: driveDistanceFromY(y) },
      });
      if (!wasComplete && hasClub) onComplete?.();
    } catch (err) {
      console.error(err);
    }
  };

  const onClubChange = async (club: string | null) => {
    // Picking a club is now the confirming tap that finishes the page (distance
    // rides with the pin, so there's no separate distance step). Advance only on
    // the transition into the complete pair, and never on the empty string the
    // "Other" chip writes while typing.
    const wasComplete = position != null && hasClub;
    try {
      await updateHole(roundId, hole.holeNumber, { driveClub: club });
      if (!wasComplete && position != null && club != null && club !== '') onComplete?.();
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
        <ThemedText type="caption"></ThemedText>
      </View>
      <View style={styles.targetWrap}>
        <DriverTarget
          pins={pins}
          onTap={handleTap}
          measurePin={position}
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
            size={16}
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
    paddingTop: 44,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.xs,
  },
  targetWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
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
    fontSize: 13,
  },
  form: {
    gap: spacing.md,
  },
  formField: {
    gap: spacing.xs,
  },
});
