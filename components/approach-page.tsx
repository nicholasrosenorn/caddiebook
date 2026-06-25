import { useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ApproachTarget } from '@/components/approach-target';
import { ClubChips } from '@/components/club-chips';
import type { TargetPin } from '@/components/driver-target';
import { InfoHint } from '@/components/info-hint';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { YardageChips } from '@/components/yardage-chips';
import { CLUB_OPTIONS } from '@/constants/clubs';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole, Shot } from '@/lib/data/models';
import { useDeleteShot, useUpdateHole, useUpsertShot } from '@/lib/data/rounds';
import { useBag, useClubYardages } from '@/lib/data/settings';
import { isLikelyOnGreen } from '@/lib/shots';
import { resolveGir } from '@/lib/stats';

type Props = {
  roundId: string;
  hole: Hole;
  shotsForRound: Shot[];
  onComplete?: () => void;
};

export function ApproachPage({ roundId, hole, shotsForRound, onComplete }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
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
      // Only the first placement pre-fills the on-green guess; moving an
      // already-placed pin must not clobber an explicit On/Missed flip (omitting
      // holePatch leaves hole.gir untouched — useUpsertShot guards on it).
      await upsertShot({
        roundId,
        holeNumber: hole.holeNumber,
        shotType: 'approach',
        xNorm: x,
        yNorm: y,
        ...(hadPin ? {} : { holePatch: { gir: isLikelyOnGreen(x, y) } }),
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

  // The green outcome is one mutually-exclusive choice: on green (GIR), missed,
  // or out of range. On/Missed write hole.gir directly (manual flips always win
  // over the placement pre-fill) and clear any prior "out of range" flag.
  // Out of range drops the placed approach + its derived data so the hole is
  // excluded from GIR and approach-execution stats — one command, the hole
  // patch rides with the shot delete — then advances to putting.
  const selectOutcome = async (outcome: 'on' | 'missed' | 'blocked') => {
    try {
      if (outcome === 'blocked') {
        if (blocked) return;
        await deleteShot(roundId, hole.holeNumber, 'approach', {
          greenBlocked: true,
          gir: null,
          approachDistanceYds: null,
          approachClub: null,
        });
        onComplete?.();
        return;
      }
      await updateHole(roundId, hole.holeNumber, {
        gir: outcome === 'on',
        ...(blocked ? { greenBlocked: false } : {}),
      });
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

  // Tapping the "No chance" text un-blocks when already blocked; the ✓/✗ buttons
  // also un-block via selectOutcome, so this is the symmetric toggle back.
  const onNoChance = async () => {
    if (!blocked) {
      await selectOutcome('blocked');
      return;
    }
    try {
      await updateHole(roundId, hole.holeNumber, { greenBlocked: false });
    } catch (err) {
      console.error(err);
    }
  };

  const resolvedGir = resolveGir(hole);

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
            measurePin={blocked ? null : position}
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
      ) : !position ? (
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
      ) : null}

      <View style={styles.girField}>
        <ThemedText type="caption">GIR</ThemedText>
        <View style={styles.girRow}>
          {(
            [
              { label: 'Hit green', value: 'on', seed: 'gir-on' },
              { label: 'Missed green', value: 'missed', seed: 'gir-off' },
            ] as const
          ).map((opt) => {
            const active = !blocked && resolvedGir === (opt.value === 'on');
            return (
              <Pressable
                key={opt.seed}
                onPress={() => selectOutcome(opt.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.girButton, pressed && !active && styles.girButtonPressed]}>
                <SketchSurface
                  seed={opt.seed}
                  fill={active ? colors.accent : colors.surface}
                  stroke={active ? colors.accent : colors.borderStrong}
                  grain={active}
                  style={styles.girButtonSurface}>
                  <ThemedText style={[styles.girButtonLabel, active && styles.girButtonLabelActive]}>
                    {opt.label}
                  </ThemedText>
                </SketchSurface>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={onNoChance}
          accessibilityRole="button"
          accessibilityState={{ selected: blocked }}
          style={({ pressed }) => [styles.noChance, pressed && styles.noChancePressed]}>
          <ThemedText style={[styles.noChanceText, blocked && styles.noChanceActive]}>
            No chance to reach green
          </ThemedText>
        </Pressable>
      </View>

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

const makeStyles = (colors: Palette, fonts: FontSet) =>
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
  girField: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  girRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  girButton: {
    height: 40,
  },
  girButtonPressed: {
    opacity: 0.6,
  },
  girButtonSurface: {
    height: 40,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  girButtonLabel: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  girButtonLabelActive: {
    color: colors.accentOn,
  },
  noChance: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  noChancePressed: {
    opacity: 0.6,
  },
  noChanceText: {
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  noChanceActive: {
    color: colors.accent,
    fontWeight: '600',
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
  form: {
    gap: spacing.md,
  },
  formField: {
    gap: spacing.xs,
  },
});
