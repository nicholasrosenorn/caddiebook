import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';

type NumericFieldProps = Omit<TextInputProps, 'value' | 'onChangeText' | 'onBlur'> & {
  value: number | null;
  min?: number;
  max?: number;
  onCommit: (next: number | null) => void;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

export function NumericField({
  value,
  min,
  max,
  onCommit,
  width,
  align = 'center',
  style,
  ...rest
}: NumericFieldProps) {
  const [text, setText] = useState<string>(value == null ? '' : String(value));

  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) {
      setText(value == null ? '' : String(value));
      return;
    }
    let clamped = parsed;
    if (min != null && clamped < min) clamped = min;
    if (max != null && clamped > max) clamped = max;
    setText(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <TextInput
      keyboardType="number-pad"
      returnKeyType="done"
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onSubmitEditing={commit}
      style={[
        styles.input,
        { textAlign: align, width },
        style,
      ]}
      placeholderTextColor={colors.textMuted}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 40,
  },
});
