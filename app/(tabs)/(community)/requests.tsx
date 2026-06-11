import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { acceptFriendRequest, declineFriendRequest, listNotifications } from '@/lib/api/client';
import { listItemIn } from '@/lib/motion';
import type { NotificationItem } from '@/lib/api/types';

// Compact relative time: "now", "5m", "3h", "2d", "4w", then a short date for older.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [items, setItems] = useState<NotificationItem[] | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await listNotifications());
    } catch {
      setItems([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAccept = useCallback(
    async (id: string, requestId: string) => {
      setItems((prev) => prev?.filter((r) => r.id !== id) ?? null);
      try {
        await acceptFriendRequest(requestId);
      } catch {
        Alert.alert('Could not accept', 'Please try again.');
        load();
      }
    },
    [load],
  );

  const onDecline = useCallback(
    async (id: string, requestId: string) => {
      setItems((prev) => prev?.filter((r) => r.id !== id) ?? null);
      try {
        await declineFriendRequest(requestId);
      } catch {
        Alert.alert('Could not decline', 'Please try again.');
        load();
      }
    },
    [load],
  );

  if (items === null) {
    return (
      <Screen>
        <View style={styles.empty}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="muted">No notifications yet.</ThemedText>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={listItemIn(index)} style={styles.row}>
            <Avatar avatar={item.from.avatar} size={40} seed={`notif-av-${item.id}`} />
            <View style={styles.rowText}>
              <ThemedText style={styles.handle} numberOfLines={1}>
                @{item.from.username}
              </ThemedText>
              <ThemedText type="muted" numberOfLines={1}>
                {item.kind === 'friend_request'
                  ? item.from.firstName
                    ? `${item.from.firstName}${item.from.lastName ? ` ${item.from.lastName}` : ''}`
                    : 'wants to be friends'
                  : item.kind === 'like'
                    ? item.courseName
                      ? `liked your round at ${item.courseName}`
                      : 'liked your round'
                    : "you're now friends"}
              </ThemedText>
            </View>
            {item.kind === 'friend_request' ? (
              <View style={styles.meta}>
                <ThemedText type="muted" style={styles.time}>
                  {timeAgo(item.createdAt)}
                </ThemedText>
                <View style={styles.actions}>
                  <PressableScale onPress={() => onAccept(item.id, item.requestId)}>
                    <SketchSurface
                      seed={`req-accept-${item.id}`}
                      fill={colors.accent}
                      stroke={colors.accent}
                      grain
                      style={styles.actionBtn}>
                      <ThemedText style={styles.actionLabel}>Accept</ThemedText>
                    </SketchSurface>
                  </PressableScale>
                  <PressableScale onPress={() => onDecline(item.id, item.requestId)}>
                    <SketchSurface
                      seed={`req-decline-${item.id}`}
                      fill={colors.surface}
                      stroke={colors.borderStrong}
                      style={styles.actionBtn}>
                      <ThemedText style={styles.declineLabel}>Decline</ThemedText>
                    </SketchSurface>
                  </PressableScale>
                </View>
              </View>
            ) : (
              <View style={styles.meta}>
                <ThemedText type="muted" style={styles.time}>
                  {timeAgo(item.createdAt)}
                </ThemedText>
                <IconSymbol
                  name={item.kind === 'like' ? 'hand.thumbsup.fill' : 'person.2.fill'}
                  size={16}
                  color={colors.textMuted}
                />
              </View>
            )}
          </Animated.View>
        )}
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    list: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    separator: {
      height: spacing.md,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.xxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    handle: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    meta: {
      alignItems: 'flex-end',
      gap: spacing.xs,
    },
    time: {
      fontSize: 12,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
    },
    actionLabel: {
      color: colors.accentOn,
      fontFamily: fonts.serif,
      fontSize: 15,
    },
    declineLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.serif,
      fontSize: 15,
    },
  });
