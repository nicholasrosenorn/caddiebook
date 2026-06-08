import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { getRoundLikers } from '@/lib/api/client';
import type { PublicProfile } from '@/lib/sync/wire';

export default function RoundLikesScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { ownerId, roundId } = useLocalSearchParams<{ ownerId: string; roundId: string }>();

  const [likers, setLikers] = useState<PublicProfile[] | null>(null);

  const load = useCallback(async () => {
    try {
      setLikers(await getRoundLikers(ownerId, roundId));
    } catch {
      setLikers([]);
    }
  }, [ownerId, roundId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (likers === null) {
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
        data={likers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText type="muted">No likes yet.</ThemedText>
          </View>
        }
        renderItem={({ item }) => {
          const fullName = [item.firstName, item.lastName].filter(Boolean).join(' ').trim();
          return (
            <View style={styles.row}>
              <IconSymbol
                name={(item.avatar as IconSymbolName) ?? 'person.crop.circle'}
                size={32}
                color={colors.accent}
              />
              <View style={styles.rowText}>
                <ThemedText style={styles.name} numberOfLines={1}>
                  {fullName || (item.username ? `@${item.username}` : 'A friend')}
                </ThemedText>
                {fullName && item.username ? (
                  <ThemedText type="muted" numberOfLines={1}>
                    @{item.username}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          );
        }}
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
    name: {
      fontFamily: fontFamily.serif,
      fontSize: 16,
      color: colors.textPrimary,
    },
  });
