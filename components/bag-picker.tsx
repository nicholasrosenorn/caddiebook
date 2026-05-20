import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS } from '@/constants/clubs';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
};

// Multi-select club bag editor — same modal pattern as the (single-select)
// club picker, but rows toggle membership and emit clubs in canonical order.
export function BagPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  const emit = (next: Set<string>) =>
    onChange(CLUB_OPTIONS.filter((c) => next.has(c)));

  const toggle = (club: string) => {
    const next = new Set(selected);
    if (next.has(club)) next.delete(club);
    else next.add(club);
    emit(next);
  };

  const count = selected.size;
  const summary =
    count === 0
      ? 'No clubs'
      : count === CLUB_OPTIONS.length
        ? `Full bag · ${count} clubs`
        : `${count} clubs`;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => pressed && styles.fieldPressed}>
        <SketchSurface seed="bag-field" radius={8} style={styles.field}>
          <ThemedText style={count === 0 ? styles.placeholder : styles.value}>{summary}</ThemedText>
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
              <Pressable onPress={() => emit(new Set(CLUB_OPTIONS))} hitSlop={6}>
                <ThemedText style={styles.quickAction}>Select all</ThemedText>
              </Pressable>
              <Pressable onPress={() => emit(new Set())} hitSlop={6}>
                <ThemedText style={styles.quickAction}>Clear</ThemedText>
              </Pressable>
            </View>

            <FlatList
              data={CLUB_OPTIONS}
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

const styles = StyleSheet.create({
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
    fontFamily: fontFamily.serif,
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
