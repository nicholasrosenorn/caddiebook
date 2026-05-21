import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YardageRuler } from '@/components/yardage-ruler';
import { CLUB_OPTIONS } from '@/constants/clubs';
import { colors, fontFamily, spacing } from '@/constants/theme';
import { getBag, getClubYardages, setClubYardage } from '@/db/queries';

const DEFAULT_YDS = 100;

export default function YardagesScreen() {
  const [clubs, setClubs] = useState<string[]>([]);
  const [yardages, setYardages] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [bag, yds] = await Promise.all([getBag(), getClubYardages()]);
    // Bag clubs only (fall back to all clubs when unset), Putter excluded,
    // preserving the canonical CLUB_OPTIONS ordering.
    const inBag = bag.length > 0 ? new Set(bag) : new Set<string>(CLUB_OPTIONS);
    setClubs(CLUB_OPTIONS.filter((c) => c !== 'Putter' && inBag.has(c)));
    setYardages(yds);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onCommit = useCallback(async (club: string, next: number | null) => {
    setYardages((prev) => {
      const out = { ...prev };
      if (next == null) delete out[club];
      else out[club] = next;
      return out;
    });
    await setClubYardage(club, next);
  }, []);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <ThemedText type="muted" style={styles.intro}>
          Your full-swing carry per club. Tap a club to set it — these prefill the yardage on the
          approach page.
        </ThemedText>

        {clubs.map((club) => (
          <Row
            key={club}
            club={club}
            yards={yardages[club] ?? null}
            isOpen={expanded === club}
            onToggle={() => setExpanded((cur) => (cur === club ? null : club))}
            onCommit={(next) => onCommit(club, next)}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

function Row({
  club,
  yards,
  isOpen,
  onToggle,
  onCommit,
}: {
  club: string;
  yards: number | null;
  isOpen: boolean;
  onToggle: () => void;
  onCommit: (next: number | null) => void;
}) {
  const defaultValue = useMemo(() => yards ?? DEFAULT_YDS, [yards]);

  return (
    <SketchSurface seed={`yds-${club}`} radius={12} style={styles.row}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${club} stock yardage`}
        style={styles.rowHead}>
        <ThemedText style={styles.club}>{club}</ThemedText>
        <View style={styles.rowRight}>
          {yards != null ? (
            <ThemedText style={styles.yards}>
              {yards} <ThemedText style={styles.unit}>yds</ThemedText>
            </ThemedText>
          ) : (
            <ThemedText style={styles.empty}>—</ThemedText>
          )}
          <IconSymbol name="chevron.down" size={20} color={colors.textMuted} />
        </View>
      </Pressable>

      {isOpen && (
        <View style={styles.ruler}>
          <YardageRuler
            value={yards}
            onCommit={onCommit}
            min={30}
            max={350}
            step={5}
            defaultValue={defaultValue}
          />
        </View>
      )}
    </SketchSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  intro: {
    fontSize: 13,
    paddingBottom: spacing.sm,
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  club: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    color: colors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  yards: {
    fontFamily: fontFamily.serifBold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  unit: {
    fontFamily: fontFamily.serif,
    fontSize: 12,
    color: colors.textSecondary,
  },
  empty: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    color: colors.textMuted,
  },
  ruler: {
    paddingTop: spacing.sm,
  },
});
