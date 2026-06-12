import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { ModerationMenu } from '@/components/moderation-menu';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import {
  AlreadyFriendsError,
  searchUsers,
  sendFriendRequest,
  UserNotFoundError,
} from '@/lib/api/client';
import type { Relation, UserSearchResult } from '@/lib/api/types';

export default function AddFriendScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  // Optimistic per-user relation overrides keyed by user id.
  const [overrides, setOverrides] = useState<Record<string, Relation>>({});
  const reqId = useRef(0);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const myReq = ++reqId.current;
    setLoading(true);
    try {
      const users = await searchUsers(trimmed);
      if (myReq === reqId.current) setResults(users);
    } catch {
      if (myReq === reqId.current) setResults([]);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, []);

  // Debounce the search as the handle is typed.
  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  const onAdd = useCallback(async (user: UserSearchResult) => {
    try {
      const res = await sendFriendRequest(user.username ?? '');
      setOverrides((o) => ({
        ...o,
        [user.id]: res.status === 'accepted' ? 'friends' : 'request_sent',
      }));
    } catch (e) {
      if (e instanceof UserNotFoundError) Alert.alert('Not found', 'That user no longer exists.');
      else if (e instanceof AlreadyFriendsError) {
        setOverrides((o) => ({ ...o, [user.id]: 'friends' }));
      } else Alert.alert('Could not send request', 'Please try again.');
    }
  }, []);

  return (
    <Screen padded={false}>
      <View style={styles.searchWrap}>
        <SketchSurface seed="add-friend-search" radius={8} style={styles.searchSurface}>
          <View style={styles.searchRow}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name or username"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
            />
          </View>
        </SketchSurface>
      </View>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : query.trim().length >= 2 ? (
            <View style={styles.empty}>
              <ThemedText type="muted">No players found.</ThemedText>
            </View>
          ) : (
            <View style={styles.empty}>
              <ThemedText type="muted" style={styles.centerText}>
                Find friends by name or @username to follow their rounds.
              </ThemedText>
            </View>
          )
        }
        renderItem={({ item }) => {
          const relation = overrides[item.id] ?? item.relation;
          return (
            <View style={styles.row}>
              <Avatar avatar={item.avatar} size={40} seed={`add-av-${item.id}`} />
              <View style={styles.rowText}>
                <ThemedText style={styles.handle}>@{item.username}</ThemedText>
                {item.firstName ? (
                  <ThemedText type="muted" numberOfLines={1}>
                    {item.firstName}
                    {item.lastName ? ` ${item.lastName}` : ''}
                  </ThemedText>
                ) : null}
              </View>
              <RelationButton relation={relation} onAdd={() => onAdd(item)} colors={colors} styles={styles} />
              <ModerationMenu
                user={item}
                onBlocked={() => setResults((prev) => prev.filter((u) => u.id !== item.id))}
              />
            </View>
          );
        }}
      />
    </Screen>
  );
}

function RelationButton({
  relation,
  onAdd,
  colors,
  styles,
}: {
  relation: Relation;
  onAdd: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  if (relation === 'friends') {
    return (
      <View style={[styles.actionBtn, styles.actionDisabled]}>
        <ThemedText style={styles.actionDisabledLabel}>Friends</ThemedText>
      </View>
    );
  }
  if (relation === 'request_sent') {
    return (
      <View style={[styles.actionBtn, styles.actionDisabled]}>
        <ThemedText style={styles.actionDisabledLabel}>Requested</ThemedText>
      </View>
    );
  }
  const label = relation === 'request_received' ? 'Accept' : 'Add';
  return (
    <PressableScale onPress={onAdd}>
      <SketchSurface
        seed={`add-action-${label}`}
        fill={colors.accent}
        stroke={colors.accent}
        grain
        style={styles.actionBtn}>
        <ThemedText style={styles.actionLabel}>{label}</ThemedText>
      </SketchSurface>
    </PressableScale>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    searchWrap: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xs,
    },
    searchSurface: {
      minHeight: 48,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    input: {
      flex: 1,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    separator: {
      height: spacing.sm,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing.xxl,
      gap: spacing.sm,
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
      minWidth: 92,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      color: colors.accentOn,
      fontFamily: fonts.serif,
      fontSize: 15,
    },
    actionDisabled: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: 8,
    },
    actionDisabledLabel: {
      color: colors.textMuted,
      fontFamily: fonts.serif,
      fontSize: 15,
    },
  });
