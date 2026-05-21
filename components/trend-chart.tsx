import { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { colors, fontFamily } from '@/constants/theme';

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
  color = colors.accent,
}: TrendChartProps) {
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
    const areaPath =
      coords.length > 1
        ? `${linePath} L${coords[coords.length - 1].x.toFixed(1)} ${(height - PAD_Y).toFixed(
            1,
          )} L${coords[0].x.toFixed(1)} ${(height - PAD_Y).toFixed(1)} Z`
        : '';
    return { coords, linePath, areaPath, min, max, baselineY: baseline != null ? y(baseline) : null };
  }, [width, height, points, baseline]);

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
              <Path d={geom.areaPath} fill={color} opacity={0.07} />
            ) : null}
            {geom.coords.length > 1 && (
              <Path d={geom.linePath} stroke={color} strokeWidth={2} fill="none" />
            )}
            {geom.coords.map((c, i) => {
              const last = i === geom.coords.length - 1;
              return (
                <Circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={last ? 4 : 2.2}
                  fill={last ? color : colors.surface}
                  stroke={color}
                  strokeWidth={last ? 0 : 1.4}
                />
              );
            })}
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

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    position: 'relative',
  },
  axis: {
    position: 'absolute',
    left: 2,
    fontFamily: fontFamily.sans,
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
    fontFamily: fontFamily.sans,
    fontSize: 10,
    color: colors.textMuted,
  },
});
