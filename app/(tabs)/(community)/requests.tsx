import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { acceptFriendRequest, declineFriendRequest, listIncomingRequests } from '@/lib/api/client';
import type { IncomingRequest } from '@/lib/sync/wire';

export default function RequestsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [requests, setRequests] = useState<IncomingRequest[] | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await listIncomingRequests());
    } catch {
      setRequests([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onAccept = useCallback(async (id: string) => {
    setRequests((prev) => prev?.filter((r) => r.id !== id) ?? null);
    try {
      await acceptFriendRequest(id);
    } catch {
      Alert.alert('Could not accept', 'Please try again.');
      load();
    }
  }, [load]);

  const onDecline = useCallback(async (id: string) => {
    setRequests((prev) => prev?.filter((r) => r.id !== id) ?? null);
    try {
      await declineFriendRequest(id);
    } catch {
      Alert.alert('Could not decline', 'Please try again.');
      load();
    }
  }, [load]);

  if (requests === null) {
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
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="muted">No pending requests.</ThemedText>
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
              {item.from.firstName ? (
                <ThemedText type="muted" numberOfLines={1}>
                  {item.from.firstName}
                  {item.from.lastName ? ` ${item.from.lastName}` : ''}
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => onAccept(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                <SketchSurface
                  seed={`req-accept-${item.id}`}
                  fill={colors.accent}
                  stroke={colors.accent}
                  grain
                  style={styles.actionBtn}>
                  <ThemedText style={styles.actionLabel}>Accept</ThemedText>
                </SketchSurface>
              </Pressable>
              <Pressable onPress={() => onDecline(item.id)} style={({ pressed }) => pressed && styles.pressed}>
                <SketchSurface
                  seed={`req-decline-${item.id}`}
                  fill={colors.surface}
                  stroke={colors.borderStrong}
                  style={styles.actionBtn}>
                  <ThemedText style={styles.declineLabel}>Decline</ThemedText>
                </SketchSurface>
              </Pressable>
            </View>
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
      fontFamily: fontFamily.serif,
      fontSize: 16,
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
      fontFamily: fontFamily.serif,
      fontSize: 15,
    },
    declineLabel: {
      color: colors.textSecondary,
      fontFamily: fontFamily.serif,
      fontSize: 15,
    },
    pressed: {
      opacity: 0.6,
    },
  });
