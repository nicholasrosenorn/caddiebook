import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, type LayoutChangeEvent } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { radius, spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

type Props = {
  value: number | null;
  onCommit: (next: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  // Where the strip parks when nothing is set yet (e.g. the club's stock
  // yardage) — centered as a suggestion, not committed.
  defaultValue?: number;
};

const CHIP_W = 64;
const GAP = spacing.sm;

// Tap-first yardage selector: one horizontal strip of 5-yd chips, styled like
// ClubChips (filled green when selected, paper + drawn outline otherwise).
// Auto-centers on the saved value or `defaultValue`; a single tap commits.
export function YardageChips({
  value,
  onCommit,
  min = 40,
  max = 300,
  step = 5,
  defaultValue = 125,
}: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const didCenter = useRef(false);

  const yards: number[] = [];
  for (let v = min; v <= max; v += step) yards.push(v);

  // Center the strip once per mount (remounted on club change by the parent).
  useEffect(() => {
    if (width === 0 || didCenter.current) return;
    didCenter.current = true;
    const target = Math.max(min, Math.min(max, value ?? defaultValue));
    const i = Math.round((target - min) / step);
    const x = Math.max(0, i * (CHIP_W + GAP) - (width - CHIP_W) / 2);
    scrollRef.current?.scrollTo({ x, animated: false });
  }, [width, value, defaultValue, min, max, step]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={onLayout}
      contentContainerStyle={styles.row}>
      {yards.map((v) => {
        const selected = value === v;
        return (
          <Pressable
            key={v}
            // tapping the selected chip again clears it
            onPress={() => onCommit(selected ? null : v)}
            style={({ pressed }) => pressed && styles.pressed}>
            <SketchSurface
              seed={`yds-${v}`}
              radius={radius.pill}
              fill={selected ? colors.accent : colors.surface}
              stroke={selected ? colors.accent : colors.borderStrong}
              grain={selected}
              style={styles.chip}>
              <ThemedText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {v}
              </ThemedText>
            </SketchSurface>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: GAP,
      paddingVertical: 2,
      paddingRight: spacing.md,
    },
    chip: {
      width: CHIP_W,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    chipLabelSelected: {
      color: colors.accentOn,
    },
    pressed: {
      opacity: 0.6,
    },
  });
