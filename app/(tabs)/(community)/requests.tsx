import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { acceptFriendRequest, declineFriendRequest, listNotifications } from '@/lib/api/client';
import type { NotificationItem } from '@/lib/sync/wire';

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
        renderItem={({ item }) => (
          <View style={styles.row}>
            <IconSymbol
              name={(item.from.avatar as IconSymbolName) ?? 'person.crop.circle'}
              size={32}
              color={colors.accent}
            />
            <View style={styles.rowText}>
              <ThemedText style={styles.handle}>@{item.from.username}</ThemedText>
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
              <View style={styles.actions}>
                <Pressable
                  onPress={() => onAccept(item.id, item.requestId)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <SketchSurface
                    seed={`req-accept-${item.id}`}
                    fill={colors.accent}
                    stroke={colors.accent}
                    grain
                    style={styles.actionBtn}>
                    <ThemedText style={styles.actionLabel}>Accept</ThemedText>
                  </SketchSurface>
                </Pressable>
                <Pressable
                  onPress={() => onDecline(item.id, item.requestId)}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <SketchSurface
                    seed={`req-decline-${item.id}`}
                    fill={colors.surface}
                    stroke={colors.borderStrong}
                    style={styles.actionBtn}>
                    <ThemedText style={styles.declineLabel}>Decline</ThemedText>
                  </SketchSurface>
                </Pressable>
              </View>
            ) : (
              <IconSymbol
                name={item.kind === 'like' ? 'heart.fill' : 'person.2.fill'}
                size={18}
                color={colors.textMuted}
              />
            )}
          </View>
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
    pressed: {
      opacity: 0.6,
    },
  });
