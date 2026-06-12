import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { JournalTag } from '@/lib/data/models';
import {
  useCreateJournalEntry,
  useDeleteJournalEntry,
  useJournal,
  useUpdateJournalEntry,
} from '@/lib/data/journal';
import { JOURNAL_TAGS, journalTagPlaceholder } from '@/lib/journal';

export default function JournalEntryScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const [tag, setTag] = useState<JournalTag>('swing_thought');
  const [body, setBody] = useState('');
  // Null until a new entry has been persisted; then it holds the row id.
  const [entryId, setEntryId] = useState<string | null>(isNew ? null : (id ?? null));
  const [loaded, setLoaded] = useState(isNew);

  const { data: entries } = useJournal();
  const createEntry = useCreateJournalEntry();
  const updateEntry = useUpdateJournalEntry();
  const deleteEntry = useDeleteJournalEntry();

  // Refs mirror the latest state so the unmount save sees current values.
  const tagRef = useRef(tag);
  const bodyRef = useRef(body);
  const entryIdRef = useRef(entryId);
  tagRef.current = tag;
  bodyRef.current = body;
  entryIdRef.current = entryId;

  // The last-persisted tag/body, so a write is skipped when nothing changed.
  // Bumping updated_at on a no-op save would reorder the list and falsify the date.
  const savedTagRef = useRef<JournalTag | null>(null);
  const savedBodyRef = useRef<string | null>(null);

  // Hydrate an existing entry from the cached journal list.
  useEffect(() => {
    if (isNew || !id || loaded) return;
    const entry = entries?.find((e) => e.id === id);
    if (!entry) return;
    setTag(entry.tag);
    setBody(entry.body ?? '');
    savedTagRef.current = entry.tag;
    savedBodyRef.current = (entry.body ?? '').trim();
    setLoaded(true);
  }, [id, isNew, loaded, entries]);

  // Persist on unmount (covers leaving via the header back button).
  useEffect(() => {
    return () => {
      const trimmed = bodyRef.current.trim();
      if (entryIdRef.current) {
        // Skip a no-op save so we don't bump the entry's date for an untouched open.
        if (tagRef.current === savedTagRef.current && trimmed === savedBodyRef.current) return;
        void updateEntry(entryIdRef.current, { tag: tagRef.current, body: trimmed });
      } else if (trimmed.length > 0) {
        void createEntry({ tag: tagRef.current, body: trimmed });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on unmount
  }, []);

  // Write-through save used after tag change and on body blur. Returns the id.
  const persist = async (nextTag: JournalTag, nextBody: string): Promise<string | null> => {
    const trimmed = nextBody.trim();
    if (entryId) {
      // Only write (and bump the date) when the tag or body actually changed.
      if (nextTag === savedTagRef.current && trimmed === savedBodyRef.current) return entryId;
      savedTagRef.current = nextTag;
      savedBodyRef.current = trimmed;
      await updateEntry(entryId, { tag: nextTag, body: trimmed });
      return entryId;
    }
    if (trimmed.length === 0) return null;
    const newId = await createEntry({ tag: nextTag, body: trimmed });
    savedTagRef.current = nextTag;
    savedBodyRef.current = trimmed;
    // Update the ref synchronously so the unmount-save (which may run before the
    // next render) sees the new id and updates rather than creating a duplicate.
    entryIdRef.current = newId;
    setEntryId(newId);
    return newId;
  };

  const onSelectTag = (next: JournalTag) => {
    setTag(next);
    persist(next, body);
  };

  const onBlurBody = () => {
    persist(tag, body);
  };

  const onDone = async () => {
    await persist(tag, body);
    router.back();
  };

  const onDelete = () => {
    if (!entryId) {
      router.back();
      return;
    }
    Alert.alert('Delete entry?', 'This note will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Prevent the unmount effect from re-creating the row.
          setBody('');
          setEntryId(null);
          await deleteEntry(entryId);
          router.back();
        },
      },
    ]);
  };

  if (!loaded) return <Screen />;

  return (
    <Screen padded={false}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={onDone}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Done">
              <ThemedText style={styles.doneLabel}>Done</ThemedText>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <ThemedText type="caption">TAG</ThemedText>
        <View style={styles.tagRow}>
          {JOURNAL_TAGS.map((t) => {
            const selected = t.key === tag;
            return (
              <Pressable
                key={t.key}
                onPress={() => onSelectTag(t.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.chipWrap, pressed && styles.pressed]}>
                <SketchSurface
                  seed={`journal-tag-${t.key}`}
                  fill={selected ? colors.accent : colors.surfaceAlt}
                  stroke={selected ? colors.accent : colors.borderStrong}
                  radius={20}
                  grain={selected}
                  style={styles.chip}>
                  <ThemedText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                    {t.label}
                  </ThemedText>
                </SketchSurface>
              </Pressable>
            );
          })}
        </View>

        <SketchSurface seed="journal-body" fill={colors.surfaceAlt} style={styles.inputSurface}>
          <TextInput
            value={body}
            onChangeText={setBody}
            onBlur={onBlurBody}
            placeholder={journalTagPlaceholder(tag)}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            multiline
            autoFocus={isNew}
            textAlignVertical="top"
          />
        </SketchSurface>

        {entryId ? (
          <Pressable
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel="Delete entry"
            style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}>
            <IconSymbol name="trash" size={18} color={colors.danger} />
            <ThemedText style={styles.deleteLabel}>Delete entry</ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: spacing.md,
      gap: spacing.sm,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    chipWrap: {
      minHeight: 40,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipLabel: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textSecondary,
    },
    chipLabelSelected: {
      color: colors.accentOn,
      fontFamily: fonts.serifBold,
    },
    inputSurface: {
      minHeight: 220,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    input: {
      flex: 1,
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 25,
      color: colors.textPrimary,
      minHeight: 200,
      paddingTop: spacing.xs,
    },
    pressed: {
      opacity: 0.6,
    },
    deleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
    },
    deleteLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.danger,
    },
    doneLabel: {
      fontFamily: fonts.serifBold,
      fontSize: 17,
      lineHeight: 23,
      color: colors.accent,
    },
  });
