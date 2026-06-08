import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

// A drawn on/off switch in the two-color language: a radius-999 SketchSurface
// track with a knob that parks left (off) or right (on). Filled green + grain
// when on, paper + drawn outline when off — the standard selection convention.
export function SettingToggle({
  label,
  value,
  onChange,
  seed,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  seed: string;
  hint?: string;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.row}
        onPress={() => onChange(!value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}>
        <ThemedText type="caption">{label}</ThemedText>
        <SketchSurface
          seed={seed}
          radius={999}
          fill={value ? colors.accent : colors.surface}
          stroke={value ? colors.accent : colors.borderStrong}
          grain={value}
          style={[styles.track, value ? styles.trackOn : styles.trackOff]}>
          <View
            style={[
              styles.knob,
              { backgroundColor: value ? colors.accentOn : colors.borderStrong },
            ]}
          />
        </SketchSurface>
      </Pressable>
      {hint ? <ThemedText style={styles.hint}>{hint}</ThemedText> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    track: {
      width: 52,
      height: 30,
      justifyContent: 'center',
    },
    trackOn: {
      alignItems: 'flex-end',
    },
    trackOff: {
      alignItems: 'flex-start',
    },
    knob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      marginHorizontal: 3,
    },
    hint: {
      fontSize: 13,
      color: colors.textMuted,
    },
  });
