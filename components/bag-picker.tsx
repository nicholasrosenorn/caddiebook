import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS } from '@/constants/clubs';
import { radius, spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Fixed field label; when set, replaces the "N clubs" count summary. */
  label?: string;
  /** Which clubs the list offers (defaults to the full set). Toggling, "Select
   *  all" and "Clear" only affect these — clubs outside the list are preserved. */
  options?: readonly string[];
};

// Multi-select club bag editor — same modal pattern as the (single-select)
// club picker, but rows toggle membership and emit clubs in canonical order.
export function BagPicker({ value, onChange, label, options = CLUB_OPTIONS }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const optionSet = new Set(options);

  // Always emit in canonical order; CLUB_OPTIONS iteration preserves any
  // selected clubs that aren't in the offered `options`.
  const emit = (next: Set<string>) =>
    onChange(CLUB_OPTIONS.filter((c) => next.has(c)));

  const toggle = (club: string) => {
    const next = new Set(selected);
    if (next.has(club)) next.delete(club);
    else next.add(club);
    emit(next);
  };

  // Select-all / clear act only on the offered options, leaving the rest as-is.
  const selectAll = () => emit(new Set([...selected, ...options]));
  const clear = () => emit(new Set([...selected].filter((c) => !optionSet.has(c))));

  const count = options.filter((c) => selected.has(c)).length;
  const summary =
    label ??
    (count === 0
      ? 'No clubs'
      : count === options.length
        ? `Full bag · ${count} clubs`
        : `${count} clubs`);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => pressed && styles.fieldPressed}>
        <SketchSurface seed="bag-field" radius={8} style={styles.field}>
          <ThemedText style={label == null && count === 0 ? styles.placeholder : styles.value}>
            {summary}
          </ThemedText>
          <ThemedText type="muted">›</ThemedText>
        </SketchSurface>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <ThemedText type="subtitle">Your bag</ThemedText>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <ThemedText style={styles.close}>Done</ThemedText>
              </Pressable>
            </View>

            <View style={styles.quickRow}>
              <Pressable onPress={selectAll} hitSlop={6}>
                <ThemedText style={styles.quickAction}>Select all</ThemedText>
              </Pressable>
              <Pressable onPress={clear} hitSlop={6}>
                <ThemedText style={styles.quickAction}>Clear</ThemedText>
              </Pressable>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const isSelected = selected.has(item);
                return (
                  <Pressable
                    onPress={() => toggle(item)}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
                    <ThemedText style={isSelected ? styles.optionLabelSelected : undefined}>
                      {item}
                    </ThemedText>
                    <ThemedText style={[styles.checkmark, !isSelected && styles.checkmarkHidden]}>
                      ✓
                    </ThemedText>
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  fieldPressed: {
    opacity: 0.6,
  },
  value: {
    color: colors.textPrimary,
  },
  placeholder: {
    color: colors.textMuted,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  close: {
    color: colors.accent,
    fontWeight: '600',
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  quickAction: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.accent,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  optionPressed: {
    backgroundColor: colors.accentMuted,
  },
  optionLabelSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  checkmark: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  checkmarkHidden: {
    opacity: 0,
  },
});
