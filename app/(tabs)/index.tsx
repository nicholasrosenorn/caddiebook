import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';
import { deleteRound, getHolesForRound, listRounds } from '@/db/queries';
import type { Round, RoundSummary } from '@/db/types';
import { computeRoundSummary, formatPct } from '@/lib/stats';

type RoundWithSummary = Round & { summary: RoundSummary };

export default function RoundsScreen() {
  const [rounds, setRounds] = useState<RoundWithSummary[] | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
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
              await deleteRound(round.id);
              await load();
            },
          },
        ],
      );
    },
    [load],
  );

  if (rounds === null) {
    return <Screen />;
  }

  if (rounds.length === 0) {
    return (
      <Screen>
        <View style={styles.emptyState}>
          <ThemedText type="subtitle">No rounds yet</ThemedText>
          <ThemedText type="muted" style={styles.emptyCopy}>
            Tap the + button to log your first round.
          </ThemedText>
          <Pressable
            onPress={() => router.push('/round/new')}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
            <ThemedText style={styles.ctaLabel}>Start your first round</ThemedText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={rounds}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
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
          </Pressable>
        )}
      />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
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

const styles = StyleSheet.create({
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
  cta: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },
  ctaPressed: {
    backgroundColor: colors.accentPressed,
  },
  ctaLabel: {
    color: colors.accentOn,
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  separator: {
    height: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.accentMuted,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
