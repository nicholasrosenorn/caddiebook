import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { InfoHint } from '@/components/info-hint';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { deleteJournalEntry, listJournalEntries } from '@/db/queries';
import type { JournalEntry, JournalTag } from '@/db/types';
import { JOURNAL_TAGS, journalPreviewTitle, journalTagLabel } from '@/lib/journal';

type TagFilter = JournalTag | 'all';

const FILTER_OPTIONS: DropdownOption<TagFilter>[] = [
  { value: 'all', label: 'All entries', short: 'All' },
  ...JOURNAL_TAGS.map((t) => ({ value: t.key, label: t.label })),
];

export default function JournalScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [tag, setTag] = useState<TagFilter>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setEntries(await listJournalEntries());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = useCallback(
    (entry: JournalEntry) => {
      Alert.alert('Delete entry?', 'This note will be permanently deleted.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteJournalEntry(entry.id);
            await load();
          },
        },
      ]);
    },
    [load],
  );

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (tag !== 'all' && e.tag !== tag) return false;
      if (q && !(e.body ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, tag, query]);

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRight}>
              <InfoHint
                title="Using the journal"
                message={
                  'Capture quick notes between rounds and range sessions.\n\n' +
                  '• Tap + to add an entry, then pick a tag: Swing thought, Practice session, or Round summary.\n' +
                  '• Notes save automatically — just tap Done when you’re finished.\n' +
                  '• Filter by tag or search the text to find an entry.\n' +
                  '• Tap an entry to edit it; long-press to delete.'
                }
                size={22}
              />
            </View>
          ),
        }}
      />
      <View style={styles.header}>
        <View style={styles.controls}>
          <DropdownSelect
            seed="journal-filter"
            value={tag}
            options={FILTER_OPTIONS}
            onChange={setTag}
          />
          <SketchSurface seed="journal-search" radius={10} style={styles.searchSurface}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </SketchSurface>
        </View>
      </View>

      {entries === null ? null : filtered.length === 0 ? (
        <View style={styles.empty}>
          <ThemedText type="subtitle">
            {entries.length === 0 ? 'No entries yet' : 'No matches'}
          </ThemedText>
          <ThemedText type="muted" style={styles.emptyCopy}>
            {entries.length === 0
              ? 'Tap + to capture a swing thought, practice session, or round note.'
              : 'Try a different tag or search term.'}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const title = journalPreviewTitle(item.body);
            return (
              <Pressable
                onPress={() => router.push(`/journal/${item.id}` as any)}
                onLongPress={() => confirmDelete(item)}
                delayLongPress={400}
                style={({ pressed }) => [styles.cardWrap, pressed && styles.pressed]}>
                <SketchSurface seed={`journal-${item.id}`} style={styles.card}>
                  <View style={styles.cardTop}>
                    <ThemedText type="caption">{journalTagLabel(item.tag).toUpperCase()}</ThemedText>
                    <ThemedText type="muted" style={styles.cardDate}>
                      {formatDate(item.updatedAt)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.cardBody} numberOfLines={3}>
                    {title || 'Empty note'}
                  </ThemedText>
                </SketchSurface>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        onPress={() => router.push('/journal/new' as any)}
        accessibilityRole="button"
        accessibilityLabel="New journal entry"
        style={({ pressed }) => [
          styles.fab,
          { bottom: insets.bottom + spacing.lg },
          pressed && styles.pressed,
        ]}>
        <SketchSurface
          seed="journal-fab"
          fill={colors.accent}
          stroke={colors.accent}
          radius={28}
          grain
          style={styles.fabInner}>
          <IconSymbol name="plus" size={26} color={colors.accentOn} />
        </SketchSurface>
      </Pressable>
    </Screen>
  );
}

function formatDate(iso: string): string {
  // Stored as UTC "YYYY-MM-DD HH:MM:SS" by SQLite datetime('now').
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    headerRight: {
      paddingHorizontal: spacing.md,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    searchSurface: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 42,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      flex: 1,
      fontFamily: fontFamily.serif,
      fontSize: 16,
      color: colors.textPrimary,
      paddingVertical: spacing.sm,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.sm,
    },
    emptyCopy: {
      textAlign: 'center',
    },
    list: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    separator: {
      height: spacing.md,
    },
    cardWrap: {
      minHeight: 84,
    },
    card: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardDate: {
      fontSize: 12,
    },
    cardBody: {
      fontFamily: fontFamily.serif,
      fontSize: 17,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    pressed: {
      opacity: 0.6,
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      width: 56,
      height: 56,
    },
    fabInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
