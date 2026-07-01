import { useEffect, useId, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

const AnimatedPath = Animated.createAnimatedComponent(Path);

type TrendChartProps = {
  /** Chronological values, oldest → newest. */
  points: number[];
  height?: number;
  /** Optional reference line (e.g. 0 for to-par, or a target). */
  baseline?: number;
  baselineLabel?: string;
  formatValue?: (n: number) => string;
  /** When true, higher values are worse (to-par, putts) — affects nothing but
   *  is reserved for future color cues; the line stays the accent ink. */
  color?: string;
};

const PAD_X = 8;
const PAD_Y = 14;

export function TrendChart({
  points,
  height = 96,
  baseline,
  baselineLabel,
  formatValue = (n) => `${Math.round(n)}`,
  color,
}: TrendChartProps) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const tint = color ?? colors.accent;
  const gradientId = `trend-grad-${useId().replace(/:/g, '')}`;
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  const geom = useMemo(() => {
    if (width === 0 || points.length === 0) return null;
    const values = baseline != null ? [...points, baseline] : points;
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const innerW = width - PAD_X * 2;
    const innerH = height - PAD_Y * 2;
    const x = (i: number) =>
      points.length === 1 ? width / 2 : PAD_X + (i / (points.length - 1)) * innerW;
    const y = (v: number) => PAD_Y + innerH - ((v - min) / (max - min)) * innerH;

    const coords = points.map((v, i) => ({ x: x(i), y: y(v), v }));
    const linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    let length = 0;
    for (let i = 1; i < coords.length; i++) {
      length += Math.hypot(coords[i].x - coords[i - 1].x, coords[i].y - coords[i - 1].y);
    }
    const areaPath =
      coords.length > 1
        ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)} ${(height - PAD_Y).toFixed(
            1,
          )} L${coords[0].x.toFixed(1)} ${(height - PAD_Y).toFixed(1)} Z`
        : '';
    return { coords, linePath, areaPath, length, min, max, baselineY: baseline != null ? y(baseline) : null };
  }, [width, height, points, baseline]);

  // Draw-on: the line traces itself (strokeDashoffset → 0) while the fill fades in,
  // replaying whenever the geometry (re)appears — e.g. a section is shown.
  const drawLength = geom?.length ?? 0;
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!geom || geom.coords.length < 2) return;
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [geom?.linePath, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const lineProps = useAnimatedProps(() => ({
    strokeDashoffset: drawLength * (1 - progress.value),
  }));
  const areaProps = useAnimatedProps(() => ({
    fillOpacity: progress.value,
  }));

  return (
    <View onLayout={onLayout} style={[styles.wrap, { height }]}>
      {geom && (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {geom.baselineY != null && (
              <Line
                x1={PAD_X}
                y1={geom.baselineY}
                x2={width - PAD_X}
                y2={geom.baselineY}
                stroke={colors.borderStrong}
                strokeWidth={1}
                strokeDasharray="3 4"
                opacity={0.7}
              />
            )}
            {geom.areaPath ? (
              <>
                <Defs>
                  <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={tint} stopOpacity={0.2} />
                    <Stop offset="1" stopColor={tint} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <AnimatedPath d={geom.areaPath} fill={`url(#${gradientId})`} animatedProps={areaProps} />
              </>
            ) : null}
            {geom.coords.length > 1 && (
              <AnimatedPath
                d={geom.linePath}
                stroke={tint}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeDasharray={geom.length}
                animatedProps={lineProps}
              />
            )}
          </Svg>
          {/* y-axis range hints */}
          <ThemedText style={[styles.axis, styles.axisTop]}>{formatValue(geom.max)}</ThemedText>
          <ThemedText style={[styles.axis, styles.axisBottom]}>
            {formatValue(geom.min)}
          </ThemedText>
          {baseline != null && baselineLabel ? (
            <ThemedText style={[styles.baselineLabel, { top: (geom.baselineY ?? 0) - 7 }]}>
              {baselineLabel}
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  wrap: {
    width: '100%',
    position: 'relative',
  },
  axis: {
    position: 'absolute',
    left: 2,
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
  axisTop: {
    top: 0,
  },
  axisBottom: {
    bottom: 0,
  },
  baselineLabel: {
    position: 'absolute',
    right: 2,
    textAlign: 'right',
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.textMuted,
  },
});
