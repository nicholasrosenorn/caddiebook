import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
    <SketchSurface seed="numeric-field" radius={8} style={[styles.surface, { width }]}>
      <View style={styles.inner}>
        <TextInput
          keyboardType="number-pad"
          returnKeyType="done"
          value={text}
          onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onSubmitEditing={commit}
          style={[styles.input, { textAlign: align }, style]}
          placeholderTextColor={colors.textMuted}
          {...rest}
        />
      </View>
    </SketchSurface>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  surface: {
    minHeight: 40,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 40,
  },
});
