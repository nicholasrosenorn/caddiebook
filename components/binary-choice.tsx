import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, radius, spacing } from '@/constants/theme';

type Props = {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
};

export function BinaryChoice({ label, hint, value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.label}>{label}</ThemedText>
        {hint ? <ThemedText type="caption">{hint}</ThemedText> : null}
      </View>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(value === true ? null : true)}
          style={({ pressed }) => [
            styles.button,
            value === true && styles.buttonSelected,
            pressed && value !== true && styles.buttonPressed,
          ]}>
          <IconSymbol
            name="checkmark"
            size={22}
            color={value === true ? colors.accentOn : colors.textPrimary}
          />
        </Pressable>
        <Pressable
          onPress={() => onChange(value === false ? null : false)}
          style={({ pressed }) => [
            styles.button,
            value === false && styles.buttonSelected,
            pressed && value !== false && styles.buttonPressed,
          ]}>
          <IconSymbol
            name="xmark"
            size={22}
            color={value === false ? colors.accentOn : colors.textPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  buttonPressed: {
    backgroundColor: colors.accentMuted,
  },
});
