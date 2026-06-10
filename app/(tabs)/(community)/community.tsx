import * as Haptics from 'expo-haptics';
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
import { useBottomTabBarHeight } from 'react-native-bottom-tabs';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { EdgeSwipeOpener } from '@/components/edge-swipe-opener';
import { HeaderIconButton } from '@/components/header-icon-button';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SketchDivider, SketchSurface, TopoChip } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { getFeed, getIncomingRequestCount, likeRound, unlikeRound } from '@/lib/api/client';
import { wireHoleToHole } from '@/lib/community/map';
import { formatToPar } from '@/lib/lifetime-stats';
import { listItemIn } from '@/lib/motion';
import { computeRoundSummary, formatPct, totalPar } from '@/lib/stats';
import { useSync } from '@/lib/sync/provider';
import type { FeedRound } from '@/lib/sync/wire';

export default function CommunityScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
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
      <HeaderIconButton
        name="person.badge.plus"
        accessibilityLabel="Add friends"
        color={colors.textPrimary}
        onPress={() => router.push('/add-friend' as any)}
      />
    ),
    [colors.textPrimary],
  );

  const headerRight = useCallback(
    () => (
      <HeaderIconButton
        name="bell"
        accessibilityLabel="Friend requests"
        color={colors.textPrimary}
        badge={badge > 0}
        onPress={() => router.push('/requests' as any)}
      />
    ),
    [badge, colors.textPrimary],
  );

  if (!session) {
    return (
      <Screen marks>
        <View style={styles.empty}>
          <TopoChip seed="community-signed-out" />
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
          ListHeaderComponent={
            <View style={styles.lockup}>
              <ThemedText type="caption" style={styles.kicker}>
                FRIENDS&apos; ROUNDS
              </ThemedText>
              <ThemedText style={styles.lockupTitle}>Clubhouse</ThemedText>
            </View>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <TopoChip seed="community-empty" />
              <ThemedText type="subtitle">Quiet out here</ThemedText>
              <ThemedText type="muted" style={styles.copy}>
                Add friends to see their rounds, or share your own from a round&apos;s settings.
              </ThemedText>
              <PressableScale
                onPress={() => router.push('/add-friend' as any)}
                accessibilityRole="button"
                style={styles.emptyCtaWrap}>
                <SketchSurface
                  seed="feed-empty-cta"
                  fill={colors.accent}
                  stroke={colors.accent}
                  radius={10}
                  style={styles.emptyCta}>
                  <ThemedText style={styles.emptyCtaLabel}>Find friends</ThemedText>
                </SketchSurface>
              </PressableScale>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footer}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={listItemIn(index)}>
              <FeedCard item={item} onToggleLike={() => onToggleLike(item)} colors={colors} styles={styles} />
            </Animated.View>
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
    <PressableScale
      pressedScale={0.98}
      haptic={false}
      onPress={() => router.push(`/community/round/${item.ownerId}/${item.id}` as any)}>
      <SketchSurface seed={`feed-${item.ownerId}-${item.id}`} style={styles.card}>
        <View style={styles.owner}>
          <Avatar avatar={item.owner.avatar} size={40} seed={`feed-av-${item.ownerId}`} />
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
          <ThemedText type="muted" style={styles.date}>{formatDate(item.datePlayed)}</ThemedText>
        </View>

        <ThemedText type="subtitle" numberOfLines={1} style={styles.course}>
          {item.courseName || 'Untitled round'}
        </ThemedText>

        <View style={styles.scoreRow}>
          <ThemedText style={styles.toPar}>{toPar}</ThemedText>
          <ThemedText style={styles.gross}>{played ? summary.totalScore : '—'}</ThemedText>
        </View>

        <SketchDivider seed={`feed-div-${item.ownerId}-${item.id}`} />

        <View style={styles.cardStats}>
          <Stat label="GIR" value={formatPct(summary.girPct)} styles={styles} />
          <Stat label="FIR" value={formatPct(summary.firPct)} styles={styles} />
          <Stat label="Putts" value={summary.totalPutts > 0 ? String(summary.totalPutts) : '—'} styles={styles} />
          <View style={styles.likeBtn}>
            <LikeButton liked={item.likedByMe} onPress={onToggleLike} colors={colors} />
            <PressableScale
              haptic={false}
              onPress={() =>
                router.push(`/community/likes/${item.ownerId}/${item.id}` as any)
              }
              hitSlop={8}
              accessibilityLabel="See who liked this round">
              <ThemedText style={styles.likeCount}>{item.likeCount}</ThemedText>
            </PressableScale>
          </View>
        </View>
      </SketchSurface>
    </PressableScale>
  );
}

// The like tap pops: a quick press-down then a springy return with a slight
// overshoot — physical feedback for the one real action on the card. The
// optimistic state change happens in the parent; this is purely the feel.
function LikeButton({
  liked,
  onPress,
  colors,
}: {
  liked: boolean;
  onPress: () => void;
  colors: Palette;
}) {
  const scale = useSharedValue(1);
  const pop = () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    scale.value = withSequence(
      withTiming(0.8, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { stiffness: 420, damping: 14 }),
    );
    onPress();
  };
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={pop}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike round' : 'Like round'}>
      <Animated.View style={popStyle}>
        <IconSymbol
          name={liked ? 'hand.thumbsup.fill' : 'hand.thumbsup'}
          size={20}
          color={liked ? colors.accent : colors.textMuted}
        />
      </Animated.View>
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
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
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
    lockup: {
      gap: spacing.xs,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    kicker: {
      fontWeight: '500',
      letterSpacing: 2,
      color: colors.textMuted,
    },
    lockupTitle: {
      fontFamily: fonts.serifBold,
      fontSize: 33,
      lineHeight: 40,
      letterSpacing: -0.4,
      color: colors.textPrimary,
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
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.accentOn,
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
      fontFamily: fonts.serifBold,
      fontSize: 17,
      lineHeight: 23,
      color: colors.textPrimary,
    },
    ownerHandle: {
      fontSize: 12,
    },
    date: {
      fontSize: 12,
      alignSelf: 'flex-start',
    },
    course: {
      color: colors.textPrimary,
      paddingTop: spacing.xs,
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
    likeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginLeft: spacing.sm,
    },
    likeCount: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textSecondary,
    },
  });
