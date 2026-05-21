import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS, OTHER_CLUB } from '@/constants/clubs';
import { radius, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

type ClubPickerProps = {
  value: string | null;
  onChange: (next: string | null) => void;
};

export function ClubPicker({ value, onChange }: ClubPickerProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const isStandard = useMemo(
    () => value != null && (CLUB_OPTIONS as readonly string[]).includes(value),
    [value],
  );
  const showOther = value != null && !isStandard;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.fieldWrap, pressed && styles.fieldPressed]}>
        <SketchSurface seed="club-field" radius={8} style={styles.field}>
          <ThemedText style={value ? styles.value : styles.placeholder}>
            {value ?? 'Select club'}
          </ThemedText>
          <ThemedText type="muted">›</ThemedText>
        </SketchSurface>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <ThemedText type="subtitle">Approach club</ThemedText>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <ThemedText style={styles.close}>Done</ThemedText>
              </Pressable>
            </View>
            <FlatList
              data={[...CLUB_OPTIONS, OTHER_CLUB]}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.list}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const selected = item === OTHER_CLUB ? showOther : item === value;
                return (
                  <Pressable
                    onPress={() => {
                      if (item === OTHER_CLUB) {
                        setOtherText(showOther ? (value ?? '') : '');
                        if (!showOther) onChange('');
                      } else {
                        onChange(item);
                        setOpen(false);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      selected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}>
                    <ThemedText style={selected ? styles.optionLabelSelected : undefined}>
                      {item}
                    </ThemedText>
                  </Pressable>
                );
              }}
              ListFooterComponent={
                showOther ? (
                  <View style={styles.otherWrap}>
                    <TextInput
                      autoFocus
                      value={otherText !== '' ? otherText : value ?? ''}
                      onChangeText={(t) => {
                        setOtherText(t);
                        onChange(t);
                      }}
                      placeholder="Type club name"
                      placeholderTextColor={colors.textMuted}
                      style={styles.otherInput}
                      returnKeyType="done"
                      onSubmitEditing={() => setOpen(false)}
                    />
                  </View>
                ) : null
              }
            />
            {value != null ? (
              <Pressable
                onPress={() => {
                  onChange(null);
                  setOpen(false);
                }}
                style={styles.clearRow}>
                <ThemedText style={styles.clearLabel}>Clear</ThemedText>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  fieldWrap: {
    minHeight: 44,
  },
  field: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
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
    maxHeight: '75%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  close: {
    color: colors.accent,
    fontWeight: '600',
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
    paddingVertical: spacing.md,
  },
  optionPressed: {
    backgroundColor: colors.accentMuted,
  },
  optionSelected: {
    // visual handled via label color
  },
  optionLabelSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
  otherWrap: {
    paddingTop: spacing.sm,
  },
  otherInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
  },
  clearRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearLabel: {
    color: colors.danger,
    fontWeight: '600',
  },
});
