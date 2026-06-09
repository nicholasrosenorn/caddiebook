import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

export type SegmentOption<T extends string> = { value: T; label: string };

// A hand-drawn segmented toggle in the two-color language: a SketchSurface track
// holding equal-width segments. The selected segment is a filled accent chip; the
// rest read as paper. Generic over the option value so callers stay type-safe.
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  seed = 'segmented',
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  seed?: string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <SketchSurface seed={seed} radius={10} fill={colors.surfaceAlt} style={styles.track}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            style={styles.segment}>
            {selected ? (
              <SketchSurface
                seed={`${seed}-${opt.value}`}
                radius={8}
                fill={colors.accent}
                stroke={colors.accent}
                style={styles.selected}>
                <ThemedText style={[styles.label, styles.labelSelected]}>{opt.label}</ThemedText>
              </SketchSurface>
            ) : (
              <ThemedText style={styles.label}>{opt.label}</ThemedText>
            )}
          </Pressable>
        );
      })}
    </SketchSurface>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: 4,
      gap: 4,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      alignItems: 'stretch',
      justifyContent: 'center',
    },
    selected: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      textAlign: 'center',
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textSecondary,
      paddingVertical: spacing.xs,
    },
    labelSelected: {
      color: colors.accentOn,
    },
  });
