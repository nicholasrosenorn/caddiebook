import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { EdgeSwipeOpener } from '@/components/edge-swipe-opener';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { getFeed, getIncomingRequestCount, likeRound, unlikeRound } from '@/lib/api/client';
import { wireHoleToHole } from '@/lib/community/map';
import { useSync } from '@/lib/sync/provider';
import type { FeedRound } from '@/lib/sync/wire';
import { computeRoundSummary, formatPct } from '@/lib/stats';

export default function CommunityScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tabBarHeight = useBottomTabBarHeight();
  const { session } = useSync();

  const [rounds, setRounds] = useState<FeedRound[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [badge, setBadge] = useState(0);

  const loadFirst = useCallback(async () => {
    try {
      const [feed, count] = await Promise.all([getFeed(), getIncomingRequestCount()]);
      setRounds(feed.rounds);
      setCursor(feed.nextCursor);
      setBadge(count);
    } catch {
      setRounds([]);
      setCursor(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (session) loadFirst();
    }, [session, loadFirst]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  }, [loadFirst]);

  const onEndReached = useCallback(async () => {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const feed = await getFeed(cursor);
      setRounds((prev) => [...(prev ?? []), ...feed.rounds]);
      setCursor(feed.nextCursor);
    } catch {
      // Leave the list as-is; pull-to-refresh can recover.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  // Optimistic like toggle, reconciled with the server's authoritative count.
  const onToggleLike = useCallback(async (item: FeedRound) => {
    const next = !item.likedByMe;
    setRounds((prev) =>
      prev?.map((r) =>
        r.id === item.id && r.ownerId === item.ownerId
          ? { ...r, likedByMe: next, likeCount: r.likeCount + (next ? 1 : -1) }
          : r,
      ) ?? null,
    );
    try {
      const res = next
        ? await likeRound(item.ownerId, item.id)
        : await unlikeRound(item.ownerId, item.id);
      setRounds((prev) =>
        prev?.map((r) =>
          r.id === item.id && r.ownerId === item.ownerId
            ? { ...r, likedByMe: res.likedByMe, likeCount: res.likeCount }
            : r,
        ) ?? null,
      );
    } catch {
      // Revert the optimistic change on failure.
      setRounds((prev) =>
        prev?.map((r) =>
          r.id === item.id && r.ownerId === item.ownerId
            ? { ...r, likedByMe: item.likedByMe, likeCount: item.likeCount }
            : r,
        ) ?? null,
      );
    }
  }, []);

  const headerRight = useCallback(
    () => (
      <View style={styles.headerActions}>
        <Pressable
          onPress={() => router.push('/add-friend' as any)}
          hitSlop={8}
          accessibilityLabel="Add friends">
          <IconSymbol name="person.badge.plus" size={24} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/requests' as any)}
          hitSlop={8}
          accessibilityLabel="Friend requests">
          <View>
            <IconSymbol name="bell" size={24} color={colors.textPrimary} />
            {badge > 0 ? (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{badge > 9 ? '9+' : badge}</ThemedText>
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    ),
    [badge, colors.textPrimary, styles],
  );

  if (!session) {
    return (
      <Screen marks>
        <View style={styles.empty}>
          <ThemedText type="subtitle">Community</ThemedText>
          <ThemedText type="muted" style={styles.copy}>
            Sign in to follow friends and compare rounds.
          </ThemedText>
        </View>
        <EdgeSwipeOpener />
      </Screen>
    );
  }

  return (
    <Screen padded={false} marks>
      <Stack.Screen options={{ headerRight }} />
      {rounds === null ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={rounds}
          keyExtractor={(item) => `${item.ownerId}:${item.id}`}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + spacing.md }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText type="subtitle">Quiet out here</ThemedText>
              <ThemedText type="muted" style={styles.copy}>
                Add friends to see their rounds, or share your own from a round&apos;s settings.
              </ThemedText>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <FeedCard item={item} onToggleLike={() => onToggleLike(item)} colors={colors} styles={styles} />
          )}
        />
      )}
      <EdgeSwipeOpener />
    </Screen>
  );
}

function FeedCard({
  item,
  onToggleLike,
  colors,
  styles,
}: {
  item: FeedRound;
  onToggleLike: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const summary = useMemo(
    () => computeRoundSummary(item.holes.map(wireHoleToHole)),
    [item.holes],
  );
  const name = item.owner.username ? `@${item.owner.username}` : item.owner.firstName ?? 'A friend';
  return (
    <Pressable
      onPress={() => router.push(`/community/round/${item.ownerId}/${item.id}` as any)}
      style={({ pressed }) => pressed && styles.pressed}>
      <SketchSurface seed={`feed-${item.ownerId}-${item.id}`} style={styles.card}>
        <View style={styles.owner}>
          <IconSymbol
            name={(item.owner.avatar as IconSymbolName) ?? 'person.crop.circle'}
            size={28}
            color={colors.accent}
          />
          <ThemedText style={styles.ownerName} numberOfLines={1}>
            {name}
          </ThemedText>
          <ThemedText type="muted">{formatDate(item.datePlayed)}</ThemedText>
        </View>

        <View style={styles.cardTop}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.course}>
            {item.courseName}
          </ThemedText>
          <ThemedText type="muted">
            {summary.holesPlayed}/{item.holeCount}
          </ThemedText>
        </View>

        <View style={styles.cardStats}>
          <Stat label="Score" value={summary.holesPlayed > 0 ? String(summary.totalScore) : '—'} colors={colors} styles={styles} />
          <Stat label="GIR" value={formatPct(summary.girPct)} colors={colors} styles={styles} />
          <Stat label="FIR" value={formatPct(summary.firPct)} colors={colors} styles={styles} />
          <Stat label="Putts" value={summary.totalPutts > 0 ? String(summary.totalPutts) : '—'} colors={colors} styles={styles} />
        </View>

        <View style={styles.cardFooter}>
          <Pressable
            onPress={onToggleLike}
            hitSlop={8}
            style={({ pressed }) => [styles.likeBtn, pressed && styles.pressed]}>
            <IconSymbol
              name={item.likedByMe ? 'heart.fill' : 'heart'}
              size={20}
              color={item.likedByMe ? colors.accent : colors.textMuted}
            />
            <ThemedText style={styles.likeCount}>{item.likeCount}</ThemedText>
          </Pressable>
        </View>
      </SketchSurface>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.stat}>
      <ThemedText type="caption">{label.toUpperCase()}</ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xxl,
    },
    copy: {
      textAlign: 'center',
      maxWidth: 280,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingRight: spacing.xs,
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: {
      color: colors.accentOn,
      fontSize: 10,
      fontFamily: fontFamily.serifBold,
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    separator: {
      height: spacing.md,
    },
    footer: {
      paddingVertical: spacing.md,
    },
    pressed: {
      opacity: 0.6,
    },
    card: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    owner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    ownerName: {
      flex: 1,
      fontFamily: fontFamily.serif,
      fontSize: 15,
      color: colors.textPrimary,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    course: {
      flex: 1,
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
      fontFamily: fontFamily.serifBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingTop: spacing.xs,
    },
    likeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    likeCount: {
      fontFamily: fontFamily.serif,
      fontSize: 15,
      color: colors.textSecondary,
    },
  });
