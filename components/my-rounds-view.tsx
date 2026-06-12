import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { router } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { SketchDivider, SketchSurface, TopoChip } from '@/components/sketch';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Round, RoundSummary } from '@/lib/data/models';
import { useDeleteRound, useRounds } from '@/lib/data/rounds';
import { formatToPar } from '@/lib/lifetime-stats';
import { listItemIn } from '@/lib/motion';
import { computeRoundSummary, formatPct, totalPar } from '@/lib/stats';

type RoundWithSummary = Round & { summary: RoundSummary; toPar: number | null };

export function MyRoundsView({ header }: { header?: ReactNode }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const tabBarHeight = useBottomTabBarHeight();
  const { data, isPending } = useRounds();
  const deleteRound = useDeleteRound();
  const [query, setQuery] = useState('');

  const rounds = useMemo<RoundWithSummary[] | null>(() => {
    if (!data) return null;
    return data.map((r) => {
      const summary = computeRoundSummary(r.holes);
      return {
        ...r,
        summary,
        toPar: summary.holesPlayed > 0 ? summary.totalScore - totalPar(r.holes) : null,
      };
    });
  }, [data]);

  const q = query.trim().toLowerCase();
  const filteredRounds = useMemo(
    () => (rounds && q ? rounds.filter((r) => r.courseName.toLowerCase().includes(q)) : rounds),
    [rounds, q],
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
            // Optimistic: the row leaves the cached list immediately; the
            // queued DELETE also removes it from the Community feed.
            onPress: () => void deleteRound(round.id),
          },
        ],
      );
    },
    [deleteRound],
  );

  // Spinner only on the very first fetch (no cached list yet — e.g. just after
  // signing in on a new device).
  if (rounds === null && isPending) {
    return (
      <View style={styles.state}>
        {header}
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <ThemedText type="muted" style={styles.emptyCopy}>
            Loading your rounds…
          </ThemedText>
        </View>
      </View>
    );
  }

  if (rounds === null || rounds.length === 0) {
    return (
      <View style={styles.state}>
        {header}
        <View style={styles.emptyState}>
          <TopoChip seed="rounds-empty" />
          <ThemedText type="subtitle">No rounds yet</ThemedText>
          <ThemedText type="muted" style={styles.emptyCopy}>
            Every round you log adds a page to the book.
          </ThemedText>
          <PressableScale
            onPress={() => router.push('/round/new')}
            accessibilityRole="button"
            style={styles.emptyCtaWrap}>
            <SketchSurface
              seed="rounds-empty-cta"
              fill={colors.accent}
              stroke={colors.accent}
              radius={10}
              style={styles.emptyCta}>
              <ThemedText style={styles.emptyCtaLabel}>Start your first round</ThemedText>
            </SketchSurface>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        data={filteredRounds ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {header}
            <SketchSurface seed="my-rounds-search" radius={8} style={styles.searchSurface}>
              <IconSymbol name="magnifyingglass" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="search by course name"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
              />
            </SketchSurface>
          </>
        }
        ListEmptyComponent={
          <ThemedText type="muted" style={styles.noMatch}>
            No rounds match “{query.trim()}”
          </ThemedText>
        }
        // Matches the Progress ScrollView: both views stay mounted, so pin the
        // top inset behavior to "never" on both to stop iOS auto-adjusting only
        // one of them (which shifted the header when switching tabs).
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.md }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={listItemIn(index)}>
            <RoundCard item={item} onDelete={() => confirmDelete(item)} styles={styles} />
          </Animated.View>
        )}
      />
    </View>
  );
}

function RoundCard({
  item,
  onDelete,
  styles,
}: {
  item: RoundWithSummary;
  onDelete: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const played = item.summary.holesPlayed > 0;
  return (
    <PressableScale
      pressedScale={0.98}
      haptic={false}
      onPress={() =>
        router.push(
          (item.completedAt ? `/round/${item.id}/summary` : `/round/${item.id}`) as any,
        )
      }
      onLongPress={onDelete}
      delayLongPress={400}>
      <SketchSurface seed={`round-${item.id}`} style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.cardTitle}>
            <ThemedText style={styles.course} numberOfLines={1}>
              {item.courseName}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText type="muted" style={styles.metaText}>
                {formatDate(item.datePlayed)}
              </ThemedText>
              {item.completedAt == null ? (
                <ThemedText type="caption" style={styles.inProgress}>
                  IN PROGRESS
                </ThemedText>
              ) : null}
            </View>
          </View>
          <ThemedText type="muted" style={styles.holes}>
            {item.summary.holesPlayed}/{item.holeCount}
          </ThemedText>
        </View>

        <View style={styles.scoreRow}>
          <ThemedText style={styles.toPar}>
            {item.toPar != null ? formatToPar(item.toPar) : '—'}
          </ThemedText>
          <ThemedText style={styles.gross}>
            {played ? item.summary.totalScore : '—'}
          </ThemedText>
        </View>

        <SketchDivider seed={`round-div-${item.id}`} />

        <View style={styles.cardStats}>
          <Stat label="GIR" value={formatPct(item.summary.girPct)} styles={styles} />
          <Stat label="FIR" value={formatPct(item.summary.firPct)} styles={styles} />
          <Stat
            label="Putts"
            value={item.summary.totalPutts > 0 ? String(item.summary.totalPutts) : '—'}
            styles={styles}
          />
        </View>
      </SketchSurface>
    </PressableScale>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof makeStyles>;
}) {
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
      maxWidth: 280,
    },
    emptyCtaWrap: {
      marginTop: spacing.md,
      minHeight: 48,
      alignSelf: 'stretch',
    },
    emptyCta: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    emptyCtaLabel: {
      color: colors.accentOn,
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    searchSurface: {
      minHeight: 44,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: spacing.md,
    },
    searchInput: {
      flex: 1,
      paddingLeft: spacing.sm,
      paddingRight: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: 16,
      color: colors.textPrimary,
      minHeight: 44,
    },
    noMatch: {
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    separator: {
      height: spacing.md,
    },
    card: {
      padding: spacing.md,
      gap: spacing.sm,
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
    course: {
      fontFamily: fonts.serifBold,
      fontSize: 17,
      lineHeight: 23,
      color: colors.textPrimary,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
    },
    metaText: {
      fontSize: 12,
    },
    inProgress: {
      color: colors.accent,
    },
    holes: {
      fontSize: 12,
      alignSelf: 'flex-start',
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    toPar: {
      fontFamily: fonts.serifBold,
      fontSize: 34,
      lineHeight: 40,
      color: colors.accent,
    },
    gross: {
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 24,
      color: colors.textMuted,
    },
    cardStats: {
      flexDirection: 'row',
      alignItems: 'center',
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
