import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { deleteRound, getHolesForRound, listRounds } from '@/db/queries';
import type { Round, RoundSummary } from '@/db/types';
import { useSync } from '@/lib/sync/provider';
import { computeRoundSummary, formatPct } from '@/lib/stats';

type RoundWithSummary = Round & { summary: RoundSummary };

export function MyRoundsView({ header }: { header?: ReactNode }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [rounds, setRounds] = useState<RoundWithSummary[] | null>(null);
  const tabBarHeight = useBottomTabBarHeight();
  const { session, syncState } = useSync();

  const load = useCallback(async () => {
    const list = await listRounds();
    const enriched = await Promise.all(
      list.map(async (r) => {
        const holes = await getHolesForRound(r.id);
        return { ...r, summary: computeRoundSummary(holes) };
      }),
    );
    setRounds(enriched);
  }, []);

  // Re-run on focus, and again when a background sync applies remote changes.
  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- dataRevision is an intentional re-run trigger
    }, [load, syncState.dataRevision]),
  );

  const confirmDelete = useCallback(
    (round: RoundWithSummary) => {
      Alert.alert(
        'Delete round?',
        `${round.courseName} · ${formatDate(round.datePlayed)} will be permanently deleted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              // deleteRound tombstones the round; the mutation-event auto-sync
              // (lib/sync/provider) pushes it so it also leaves the Community feed.
              await deleteRound(round.id);
              await load();
            },
          },
        ],
      );
    },
    [load],
  );

  // Spinner while the first local read is in flight, or while a signed-in
  // session is still pulling rounds down (e.g. just after logging back in) and
  // we don't yet have anything to show.
  const syncing = syncState.status === 'syncing';
  if (rounds === null || (rounds.length === 0 && session && syncing)) {
    return (
      <View style={styles.state}>
        {header}
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <ThemedText type="muted" style={styles.emptyCopy}>
            Syncing your rounds…
          </ThemedText>
        </View>
      </View>
    );
  }

  if (rounds.length === 0) {
    return (
      <View style={styles.state}>
        {header}
        <View style={styles.emptyState}>
          <ThemedText type="subtitle">No rounds yet</ThemedText>
          <ThemedText type="muted" style={styles.emptyCopy}>
            Tap the + Play button to log your first round.
          </ThemedText>
          <Pressable
            onPress={() => router.push('/round/new')}
            style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}>
            <SketchSurface
              seed="empty-cta"
              fill={colors.accent}
              stroke={colors.accent}
              grain
              style={styles.cta}>
              <ThemedText style={styles.ctaLabel}>Start your first round</ThemedText>
            </SketchSurface>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={rounds}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header ? <>{header}</> : null}
        // Matches the Progress ScrollView: both views stay mounted, so pin the
        // top inset behavior to "never" on both to stop iOS auto-adjusting only
        // one of them (which shifted the header when switching tabs).
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.md }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(
                (item.completedAt
                  ? `/round/${item.id}/summary`
                  : `/round/${item.id}`) as any,
              )
            }
            onLongPress={() => confirmDelete(item)}
            delayLongPress={400}
            style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}>
            <SketchSurface seed={`round-${item.id}`} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitle}>
                <ThemedText type="subtitle" numberOfLines={1}>
                  {item.courseName}
                </ThemedText>
                <ThemedText type="muted">{formatDate(item.datePlayed)}</ThemedText>
              </View>
              <ThemedText type="muted">
                {item.summary.holesPlayed}/{item.holeCount}
              </ThemedText>
            </View>
            <View style={styles.cardStats}>
              <Stat
                label="Score"
                value={item.summary.holesPlayed > 0 ? String(item.summary.totalScore) : '—'}
              />
              <Stat label="GIR" value={formatPct(item.summary.girPct)} />
              <Stat label="FIR" value={formatPct(item.summary.firPct)} />
              <Stat
                label="Putts"
                value={item.summary.totalPutts > 0 ? String(item.summary.totalPutts) : '—'}
              />
            </View>
            </SketchSurface>
          </Pressable>
        )}
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.stat}>
      <ThemedText type="caption">{label.toUpperCase()}</ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
  );
}

function formatDate(iso: string): string {
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  flex: {
    flex: 1,
  },
  state: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  emptyCopy: {
    textAlign: 'center',
  },
  ctaWrap: {
    marginTop: spacing.md,
  },
  cta: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  ctaLabel: {
    color: colors.accentOn,
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 22,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  cardWrap: {
    minHeight: 100,
  },
  card: {
    padding: spacing.md,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  cardTitle: {
    flex: 1,
    gap: 2,
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
});
