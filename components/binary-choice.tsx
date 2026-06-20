import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

type Props = {
  label: string;
  // When true and a value is shown, the value is derived (not written) — an
  // "auto" marker is rendered under the filled button.
  auto?: boolean;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
};

export function BinaryChoice({ label, auto, value, onChange }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const showAuto = auto && value != null;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.label}>{label}</ThemedText>
      </View>
      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(value === true ? null : true)}
          style={({ pressed }) => [styles.button, pressed && value !== true && styles.buttonPressed]}>
          <SketchSurface
            seed={`bin-${label}-yes`}
            fill={value === true ? colors.accent : colors.surface}
            stroke={value === true ? colors.accent : colors.borderStrong}
            grain={value === true}
            style={styles.surface}>
            <IconSymbol
              name="checkmark"
              size={22}
              color={value === true ? colors.accentOn : colors.textPrimary}
            />
          </SketchSurface>
        </Pressable>
        <Pressable
          onPress={() => onChange(value === false ? null : false)}
          style={({ pressed }) => [styles.button, pressed && value !== false && styles.buttonPressed]}>
          <SketchSurface
            seed={`bin-${label}-no`}
            fill={value === false ? colors.accent : colors.surface}
            stroke={value === false ? colors.accent : colors.borderStrong}
            grain={value === false}
            style={styles.surface}>
            <IconSymbol
              name="xmark"
              size={22}
              color={value === false ? colors.accentOn : colors.textPrimary}
            />
          </SketchSurface>
        </Pressable>
      </View>
      {showAuto && (
        <View style={styles.autoRow}>
          <View style={styles.autoCell}>
            {value === true ? <ThemedText type="caption">AUTO</ThemedText> : null}
          </View>
          <View style={styles.autoCell}>
            {value === false ? <ThemedText type="caption">AUTO</ThemedText> : null}
          </View>
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    gap: 2,
  },
  label: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  autoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  autoCell: {
    flex: 1,
    alignItems: 'center',
  },
  button: {
    flex: 1,
    height: 52,
  },
  surface: {
    flex: 1,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.6,
  },
});
