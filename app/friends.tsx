import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { listFriends, unfriend } from '@/lib/api/client';
import type { PublicProfile } from '@/lib/sync/wire';

export default function FriendsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [friends, setFriends] = useState<PublicProfile[] | null>(null);

  const load = useCallback(async () => {
    try {
      setFriends(await listFriends());
    } catch {
      setFriends([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRemove = useCallback((friend: PublicProfile) => {
    const name = friend.username ? `@${friend.username}` : 'this friend';
    Alert.alert(
      'Remove friend?',
      `${name} will no longer see your rounds, and you won't see theirs. You can add them again later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Optimistically drop the row, restore it if the call fails.
            setFriends((prev) => prev?.filter((f) => f.id !== friend.id) ?? null);
            try {
              await unfriend(friend.id);
            } catch {
              Alert.alert('Could not remove', 'Please try again.');
              load();
            }
          },
        },
      ],
    );
  }, [load]);

  const headerRight = useCallback(
    () => (
      <Pressable
        onPress={() => router.push('/add-friends' as any)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Add friends"
        style={styles.headerRight}>
        <IconSymbol name="person.badge.plus" size={24} color={colors.textPrimary} />
      </Pressable>
    ),
    [colors.textPrimary, styles],
  );

  if (friends === null) {
    return (
      <Screen>
        <Stack.Screen options={{ headerRight }} />
        <View style={styles.empty}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerRight }} />
      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="subtitle">No friends yet</ThemedText>
            <ThemedText type="muted" style={styles.centerText}>
              Find players by their @username to follow their rounds.
            </ThemedText>
            <Pressable
              onPress={() => router.push('/add-friends' as any)}
              accessibilityRole="button"
              accessibilityLabel="Add friends"
              style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}>
              <SketchSurface
                seed="friends-empty-cta"
                fill={colors.accent}
                stroke={colors.accent}
                grain
                style={styles.cta}>
                <ThemedText style={styles.ctaLabel}>Add friends</ThemedText>
              </SketchSurface>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <IconSymbol
              name={(item.avatar as IconSymbolName) ?? 'person.crop.circle'}
              size={32}
              color={colors.accent}
            />
            <View style={styles.rowText}>
              <ThemedText style={styles.handle}>
                {item.username ? `@${item.username}` : 'Golfer'}
              </ThemedText>
              {item.firstName ? (
                <ThemedText type="muted" numberOfLines={1}>
                  {item.firstName}
                  {item.lastName ? ` ${item.lastName}` : ''}
                </ThemedText>
              ) : null}
            </View>
            <Pressable onPress={() => onRemove(item)} style={({ pressed }) => pressed && styles.pressed}>
              <SketchSurface
                seed={`friend-remove-${item.id}`}
                fill={colors.surface}
                stroke={colors.borderStrong}
                style={styles.actionBtn}>
                <ThemedText style={styles.removeLabel}>Remove</ThemedText>
              </SketchSurface>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
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
      gap: spacing.sm,
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    centerText: {
      textAlign: 'center',
      maxWidth: 280,
    },
    headerRight: {
      paddingRight: spacing.xs,
    },
    ctaWrap: {
      marginTop: spacing.md,
    },
    cta: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    ctaLabel: {
      color: colors.accentOn,
      fontFamily: fontFamily.serif,
      fontSize: 16,
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
      fontFamily: fontFamily.serif,
      fontSize: 16,
      color: colors.textPrimary,
    },
    actionBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
    },
    removeLabel: {
      color: colors.textSecondary,
      fontFamily: fontFamily.serif,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.6,
    },
  });
