import { Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, fontFamily, spacing } from '@/constants/theme';

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
    fontFamily: fontFamily.serif,
    fontSize: 15,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
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
