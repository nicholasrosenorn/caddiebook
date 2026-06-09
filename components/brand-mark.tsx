import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { Crosshair, SketchSurface } from '@/components/sketch';
import { type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

// A compact framed registration emblem, used above a screen's header so the
// first-run set (sign-in, profile setup) shares a mark with the intro cover.
// Built only from existing drawn primitives — two colors, no new SVG paths.
export function BrandMark() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SketchSurface
      seed="brand-crest"
      radius={14}
      fill={colors.surface}
      stroke={colors.borderStrong}
      style={styles.crest}>
      <Crosshair size={30} strokeWidth={1.4} />
    </SketchSurface>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    crest: {
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
