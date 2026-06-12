import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { listBlockedUsers, unblockUser } from '@/lib/api/client';
import type { PublicProfile } from '@/lib/api/types';

export default function BlockedUsersScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [blocked, setBlocked] = useState<PublicProfile[] | null>(null);

  const load = useCallback(async () => {
    try {
      setBlocked(await listBlockedUsers());
    } catch {
      setBlocked([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onUnblock = useCallback(
    (user: PublicProfile) => {
      const name = user.username ? `@${user.username}` : 'this user';
      Alert.alert('Unblock?', `${name} will be able to find and follow you again. This does not restore any past friendship.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setBlocked((prev) => prev?.filter((u) => u.id !== user.id) ?? null);
            try {
              await unblockUser(user.id);
            } catch {
              Alert.alert('Could not unblock', 'Please try again.');
              load();
            }
          },
        },
      ]);
    },
    [load],
  );

  if (blocked === null) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Blocked' }} />
        <View style={styles.empty}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Blocked' }} />
      <FlatList
        data={blocked}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="subtitle">No one blocked</ThemedText>
            <ThemedText type="muted" style={styles.centerText}>
              People you block won’t see your rounds or profile, and you won’t see theirs.
            </ThemedText>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <IconSymbol
              name={(item.avatar as IconSymbolName) ?? 'person.crop.circle'}
              size={32}
              color={colors.textMuted}
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
            <Pressable onPress={() => onUnblock(item)} style={({ pressed }) => pressed && styles.pressed}>
              <SketchSurface
                seed={`unblock-${item.id}`}
                fill={colors.surface}
                stroke={colors.borderStrong}
                style={styles.actionBtn}>
                <ThemedText style={styles.actionLabel}>Unblock</ThemedText>
              </SketchSurface>
            </Pressable>
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
      gap: spacing.sm,
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.lg,
    },
    centerText: {
      textAlign: 'center',
      maxWidth: 280,
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
    actionBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 40,
    },
    actionLabel: {
      color: colors.textSecondary,
      fontFamily: fonts.serif,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.6,
    },
  });
