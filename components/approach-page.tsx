import { useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ApproachTarget } from '@/components/approach-target';
import { ClubChips } from '@/components/club-chips';
import type { TargetPin } from '@/components/driver-target';
import { InfoHint } from '@/components/info-hint';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YardageChips } from '@/components/yardage-chips';
import { CLUB_OPTIONS } from '@/constants/clubs';
import { radius, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import type { Hole, Shot } from '@/lib/data/models';
import { useDeleteShot, useUpdateHole, useUpsertShot } from '@/lib/data/rounds';
import { useBag, useClubYardages } from '@/lib/data/settings';
import { approachResult } from '@/lib/shots';

type Props = {
  roundId: string;
  hole: Hole;
  shotsForRound: Shot[];
  onComplete?: () => void;
};

export function ApproachPage({ roundId, hole, shotsForRound, onComplete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const targetSize = Math.min(320, width - 32, height * 0.5);

  const upsertShot = useUpsertShot();
  const deleteShot = useDeleteShot();
  const updateHole = useUpdateHole();

  const { bag: storedBag } = useBag();
  const bag = useMemo(
    () => (storedBag.length > 0 ? storedBag : CLUB_OPTIONS),
    [storedBag],
  );
  const { yardages } = useClubYardages();

  // Fallback park when the selected club has no stock yardage on file.
  const yardsDefault =
    hole.approachClub != null ? (yardages[hole.approachClub] ?? 125) : 125;

  // The hole is fully logged once pin + club + yards are all set.
  const hasClub = hole.approachClub != null && hole.approachClub !== '';
  const hasYards = hole.approachDistanceYds != null;

  // The pin comes straight from the cached shots — the optimistic upsert
  // updates it on the same frame as the tap.
  const approach = shotsForRound.find(
    (s) => s.holeNumber === hole.holeNumber && s.shotType === 'approach',
  );
  const position = approach ? { xNorm: approach.xNorm, yNorm: approach.yNorm } : null;

  const handleTap = async (x: number, y: number) => {
    // Advance only when this tap completes the pin + club + yards trio —
    // moving an already-placed pin shouldn't yank the page away.
    const hadPin = position != null;
    try {
      // One command: the shot plus the derived gir flag, atomic server-side.
      await upsertShot({
        roundId,
        holeNumber: hole.holeNumber,
        shotType: 'approach',
        xNorm: x,
        yNorm: y,
        holePatch: { gir: approachResult(x, y).onGreen },
      });
      if (!hadPin && hasClub && hasYards) onComplete?.();
    } catch (err) {
      console.error(err);
    }
  };

  const onClubChange = async (club: string | null) => {
    try {
      const stock = club != null ? yardages[club] : undefined;
      await updateHole(roundId, hole.holeNumber, {
        approachClub: club,
        // Prefill the approach distance with the club's stock yardage so the
        // chips reflect the pick immediately; the player nudges from there.
        // A club tap never auto-advances — the prefilled yardage still wants
        // an explicit confirming tap (or a different chip).
        ...(stock != null ? { approachDistanceYds: stock } : {}),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const onYardsCommit = async (yards: number | null) => {
    try {
      await updateHole(roundId, hole.holeNumber, { approachDistanceYds: yards });
      // Yards is the deliberate confirming tap: once the pin and club are in,
      // picking a distance finishes the page.
      if (yards != null && position != null && hasClub) onComplete?.();
    } catch (err) {
      console.error(err);
    }
  };

  const blocked = hole.greenBlocked === true;

  const onToggleBlocked = async () => {
    try {
      if (!blocked) {
        // Couldn't reach the green: drop any placed approach + its derived data
        // so the hole is excluded from GIR and approach-execution stats. One
        // command — the hole patch rides with the shot delete.
        await deleteShot(roundId, hole.holeNumber, 'approach', {
          greenBlocked: true,
          gir: null,
          approachDistanceYds: null,
          approachClub: null,
        });
        // Nothing left to log here — straight on to putting.
        onComplete?.();
        return;
      }
      await updateHole(roundId, hole.holeNumber, { greenBlocked: false });
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
      </View>
      <View style={styles.targetWrap}>
        <View
          style={blocked && styles.targetDimmed}
          pointerEvents={blocked ? 'none' : 'auto'}>
          <ApproachTarget
            pins={blocked ? [] : pins}
            onTap={blocked ? undefined : handleTap}
            size={targetSize}
          />
        </View>
      </View>
      {blocked ? (
        <View style={styles.blockedNote}>
          <ThemedText type="muted" style={styles.hint}>
            No approach to the green.
          </ThemedText>
        </View>
      ) : position ? (
        <View style={[styles.badge, isOnGreen && styles.badgePositive]}>
          <ThemedText style={[styles.badgeText, isOnGreen && styles.badgeTextPositive]}>
            {result}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.hintRow}>
          <InfoHint
            size={16}
            title="Marking your approach"
            message="Tap the ring target where your approach finished, relative to the pin at center. Distance from center sets proximity; landing inside the rings counts as a green in regulation (GIR). Tap again to move it. Set the club and yards-in below."
          />
          <ThemedText type="muted" style={styles.hint}>
            Tap to mark where your approach landed.
          </ThemedText>
        </View>
      )}

      <Pressable
        onPress={onToggleBlocked}
        accessibilityRole="button"
        accessibilityState={{ selected: blocked }}
        style={({ pressed }) => [styles.blockToggle, pressed && styles.blockTogglePressed]}>
        <SketchSurface
          seed="approach-blocked"
          fill={blocked ? colors.accent : colors.surface}
          stroke={blocked ? colors.accent : colors.borderStrong}
          grain={blocked}
          style={styles.blockToggleSurface}>
          <IconSymbol
            name={blocked ? 'checkmark' : 'xmark'}
            size={16}
            color={blocked ? colors.accentOn : colors.textSecondary}
          />
          <ThemedText
            style={[styles.blockToggleLabel, blocked && styles.blockToggleLabelActive]}>
            Couldn&apos;t reach the green
          </ThemedText>
        </SketchSurface>
      </Pressable>

      {!blocked && (
        <View style={styles.form}>
          <View style={styles.formField}>
            <ThemedText type="caption">CLUB</ThemedText>
            <ClubChips value={hole.approachClub} onChange={onClubChange} clubs={bag} />
          </View>
          <View style={styles.formField}>
            <ThemedText type="caption">YARDS IN</ThemedText>
            {/* Remount on club change so the strip re-centers on the freshly
                written stock yardage; keyed by club (not value) so picking a
                nearby chip doesn't re-center mid-edit. */}
            <YardageChips
              key={`yards-${hole.approachClub ?? 'none'}`}
              value={hole.approachDistanceYds}
              onCommit={onYardsCommit}
              defaultValue={yardsDefault}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function formatApproachLabel(x: number, y: number): string {
  const r = approachResult(x, y);
  if (!r.onGreen) return 'Off green';
  return `${r.proximityFt} ft from pin (GIR ✓)`;
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
    paddingBottom: spacing.sm,
  },
  targetWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  targetDimmed: {
    opacity: 0.35,
  },
  blockedNote: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  blockToggle: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  blockTogglePressed: {
    opacity: 0.6,
  },
  blockToggleSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  blockToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  blockToggleLabelActive: {
    color: colors.accentOn,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  hint: {
    flexShrink: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 13,
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
    gap: spacing.md,
  },
  formField: {
    gap: spacing.xs,
  },
});
