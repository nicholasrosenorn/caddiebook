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
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { getFeed, getIncomingRequestCount, likeRound, unlikeRound } from '@/lib/api/client';
import { wireHoleToHole } from '@/lib/community/map';
import { useSync } from '@/lib/sync/provider';
import type { FeedRound } from '@/lib/sync/wire';
import { computeRoundSummary, formatPct, totalPar } from '@/lib/stats';
import { formatToPar } from '@/lib/lifetime-stats';

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

  const headerLeft = useCallback(
    () => (
      <View style={styles.headerActionsLeft}>
        <Pressable
          onPress={() => router.push('/add-friend' as any)}
          hitSlop={8}
          accessibilityLabel="Add friends">
          <IconSymbol name="person.badge.plus" size={24} color={colors.textPrimary} />
        </Pressable>
      </View>
    ),
    [colors.textPrimary, styles],
  );

  const headerRight = useCallback(
    () => (
      <View style={styles.headerActions}>
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
      <Stack.Screen options={{ headerLeft, headerRight }} />
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
  const holes = useMemo(() => item.holes.map(wireHoleToHole), [item.holes]);
  const summary = useMemo(() => computeRoundSummary(holes), [holes]);
  const played = summary.holesPlayed > 0;
  const toPar = played ? formatToPar(summary.totalScore - totalPar(holes)) : '—';

  const fullName = [item.owner.firstName, item.owner.lastName].filter(Boolean).join(' ').trim();
  const displayName = fullName || (item.owner.username ? `@${item.owner.username}` : 'A friend');
  const handle = fullName && item.owner.username ? `@${item.owner.username}` : null;

  return (
    <Pressable
      onPress={() => router.push(`/community/round/${item.ownerId}/${item.id}` as any)}
      style={({ pressed }) => pressed && styles.pressed}>
      <SketchSurface seed={`feed-${item.ownerId}-${item.id}`} style={styles.card}>
        <View style={styles.owner}>
          <IconSymbol
            name={(item.owner.avatar as IconSymbolName) ?? 'person.crop.circle'}
            size={32}
            color={colors.accent}
          />
          <View style={styles.ownerText}>
            <ThemedText style={styles.ownerName} numberOfLines={1}>
              {displayName}
            </ThemedText>
            {handle ? (
              <ThemedText type="muted" style={styles.ownerHandle} numberOfLines={1}>
                {handle}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={styles.metaRow}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.course}>
            {item.courseName}
          </ThemedText>
          <ThemedText type="muted">{formatDate(item.datePlayed)}</ThemedText>
        </View>

        <View style={styles.scoreRow}>
          <ThemedText style={styles.toPar}>{toPar}</ThemedText>
          {played ? (
            <ThemedText style={styles.gross}>{summary.totalScore}</ThemedText>
          ) : null}
        </View>

        <SketchDivider seed={`feed-div-${item.ownerId}-${item.id}`} />

        <View style={styles.cardStats}>
          <Stat label="GIR" value={formatPct(summary.girPct)} styles={styles} />
          <Stat label="FIR" value={formatPct(summary.firPct)} styles={styles} />
          <Stat label="Putts" value={summary.totalPutts > 0 ? String(summary.totalPutts) : '—'} styles={styles} />
          <View style={styles.likeBtn}>
            <Pressable
              onPress={onToggleLike}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <IconSymbol
                name={item.likedByMe ? 'heart.fill' : 'heart'}
                size={20}
                color={item.likedByMe ? colors.accent : colors.textMuted}
              />
            </Pressable>
            <Pressable
              onPress={() =>
                router.push(`/community/likes/${item.ownerId}/${item.id}` as any)
              }
              hitSlop={8}
              accessibilityLabel="See who liked this round"
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.likeCount}>{item.likeCount}</ThemedText>
            </Pressable>
          </View>
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
    headerActionsLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingLeft: spacing.xs,
    },
    badge: {
      position: 'absolute',
      top: -5,
      right: -7,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    badgeText: {
      color: colors.accentOn,
      fontSize: 10,
      lineHeight: 16,
      textAlign: 'center',
      includeFontPadding: false,
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
    ownerText: {
      flex: 1,
    },
    ownerName: {
      fontFamily: fontFamily.serifBold,
      fontSize: 17,
      color: colors.textPrimary,
    },
    ownerHandle: {
      fontSize: 12,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.sm,
    },
    course: {
      flex: 1,
      color: colors.textSecondary,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    toPar: {
      fontFamily: fontFamily.serifBold,
      fontSize: 40,
      lineHeight: 44,
      color: colors.accent,
    },
    gross: {
      fontFamily: fontFamily.serif,
      fontSize: 20,
      color: colors.textSecondary,
    },
    cardStats: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.xl,
    },
    stat: {
      gap: 2,
    },
    statValue: {
      fontFamily: fontFamily.serifBold,
      fontSize: 18,
      color: colors.textPrimary,
    },
    likeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginLeft: 'auto',
    },
    likeCount: {
      fontFamily: fontFamily.serif,
      fontSize: 15,
      color: colors.textSecondary,
    },
  });
