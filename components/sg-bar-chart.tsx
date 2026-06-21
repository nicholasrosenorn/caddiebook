import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { formatSG } from '@/lib/strokes-gained';

// A strokes-gained column chart: one bar per category on a zero baseline, gaining
// (up, accent) or losing (down) strokes, with ±axis guide lines and the category
// label + signed value beneath each column. The label row shares the chart's
// column geometry so labels sit dead-centre under their bar.

export type SgBar = { key: string; label: string; value: number };

const PAD_X = 6;
const PAD_Y = 16;
const HEIGHT = 150;

// Positive = accent (a gain); losses ramp by severity so the biggest leak reads
// loudest. Colors come from the theme (accent is not green in every theme).
// Shared with the horizontal distance-band chart (components/sg-distance-bars).
export function sgBarColor(value: number, colors: Palette): string {
  if (value > 0.05) return colors.accent;
  if (value < -1.0) return colors.danger;
  if (value < -0.05) return colors.warning;
  return colors.textMuted; // ~zero
}

export function SgBarChart({ bars }: { bars: SgBar[] }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  const axisMax = Math.max(2, Math.ceil(Math.max(...bars.map((b) => Math.abs(b.value)))));
  const innerW = Math.max(0, width - PAD_X * 2);
  const innerH = HEIGHT - PAD_Y * 2;
  const zeroY = PAD_Y + innerH / 2;
  const unit = innerH / 2 / axisMax; // pixels per stroke
  const colW = innerW / bars.length;
  const barW = Math.min(48, colW * 0.5);

  return (
    <View style={styles.wrap}>
      <View onLayout={onLayout} style={{ height: HEIGHT }}>
        {width > 0 ? (
          <>
            <Svg width={width} height={HEIGHT}>
              {/* top / zero / bottom guide lines */}
              <Line x1={PAD_X} y1={PAD_Y} x2={width - PAD_X} y2={PAD_Y}
                stroke={colors.borderStrong} strokeWidth={1} opacity={0.4} />
              <Line x1={PAD_X} y1={HEIGHT - PAD_Y} x2={width - PAD_X} y2={HEIGHT - PAD_Y}
                stroke={colors.borderStrong} strokeWidth={1} opacity={0.4} />
              <Line x1={PAD_X} y1={zeroY} x2={width - PAD_X} y2={zeroY}
                stroke={colors.borderStrong} strokeWidth={1.3} />
              {bars.map((b, i) => {
                const h = b.value === 0 ? 0 : Math.max(2, Math.abs(b.value) * unit);
                const x = PAD_X + i * colW + (colW - barW) / 2;
                const y = b.value >= 0 ? zeroY - h : zeroY;
                return (
                  <Rect key={b.key} x={x} y={y} width={barW} height={h} rx={3}
                    fill={sgBarColor(b.value, colors)} />
                );
              })}
            </Svg>
            <ThemedText style={[styles.axis, styles.axisTop]}>{`+${axisMax}`}</ThemedText>
            <ThemedText style={[styles.axis, styles.axisBottom]}>{`-${axisMax}`}</ThemedText>
          </>
        ) : null}
      </View>

      {/* Labels + values, in the same column geometry as the bars */}
      <View style={styles.labelRow}>
        {bars.map((b) => (
          <View key={b.key} style={styles.labelCell}>
            <ThemedText type="caption" numberOfLines={1}>
              {b.label}
            </ThemedText>
            <ThemedText style={[styles.value, { color: sgBarColor(b.value, colors) }]} numberOfLines={1}>
              {formatSG(b.value)}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.xs,
    },
    axis: {
      position: 'absolute',
      left: 2,
      fontFamily: fonts.body,
      fontSize: 10,
      color: colors.textMuted,
    },
    axisTop: {
      top: PAD_Y - 7,
    },
    axisBottom: {
      bottom: PAD_Y - 7,
    },
    labelRow: {
      flexDirection: 'row',
      paddingHorizontal: PAD_X,
    },
    labelCell: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    value: {
      fontFamily: fonts.serifBold,
      fontSize: 16,
      lineHeight: 22,
    },
  });
