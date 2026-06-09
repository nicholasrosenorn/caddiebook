import { memo, useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { roughRectPath, sketchDividerPath, stippleInRect, wavyLines } from '@/lib/sketch';

export type RowKey = 'full' | 'tq' | 'half' | 'quarter';

// Power rows, biggest dot → smallest.
const ROWS: { key: RowKey; dotR: number }[] = [
  { key: 'full', dotR: 9 },
  { key: 'tq', dotR: 7 },
  { key: 'half', dotR: 5.5 },
  { key: 'quarter', dotR: 4 },
];

const HEIGHT = 300;
const PAD_T = 16;
const PAD_B = 30; // bottom axis (wedge labels)
const PAD_L = 36; // left axis (distance labels)
const PAD_R = 14;

type Props = {
  wedges: string[];
  /** Carry for a (club, power), or null if unset. The grid below is the editor;
      this chart only reflects whatever the grid holds. */
  getValue: (club: string, row: RowKey) => number | null;
  /** The (club, row) being edited in the grid — highlights its dot. */
  selected: { club: string; row: RowKey } | null;
};

// Snap to a nice 10-yd boundary just outside the data so the gapping staircase
// fills the plot. Falls back to a typical wedge band when nothing is set yet.
function computeDomain(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 40, max: 120 };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  let min = Math.floor((lo - 8) / 10) * 10;
  let max = Math.ceil((hi + 8) / 10) * 10;
  if (max - min < 30) max = min + 30; // keep some vertical breathing room
  return { min: Math.max(0, min), max };
}

function WedgeRangeChartImpl({ wedges, getValue, selected }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = HEIGHT - PAD_T - PAD_B;

  const domain = useMemo(() => {
    const vals: number[] = [];
    for (const club of wedges) {
      for (const r of ROWS) {
        const v = getValue(club, r.key);
        if (v != null) vals.push(v);
      }
    }
    return computeDomain(vals);
  }, [wedges, getValue]);

  const distToY = useCallback(
    (d: number) => PAD_T + (1 - (d - domain.min) / (domain.max - domain.min)) * plotH,
    [domain, plotH],
  );
  const colCenterX = useCallback(
    (i: number) => PAD_L + (plotW * (i + 0.5)) / Math.max(1, wedges.length),
    [plotW, wedges.length],
  );

  // Gridlines every 20 yds (every 10 when the range is tight), labelled on the
  // left axis like range distance markers.
  const gridStep = domain.max - domain.min <= 40 ? 10 : 20;
  const gridlines = useMemo(() => {
    const out: number[] = [];
    const start = Math.ceil(domain.min / gridStep) * gridStep;
    for (let d = start; d <= domain.max; d += gridStep) out.push(d);
    return out;
  }, [domain, gridStep]);

  // Deterministic, size-keyed chrome (frame, grass texture).
  const chrome = useMemo(() => {
    if (width === 0) return null;
    return {
      frame: roughRectPath(width, HEIGHT, 14, 'wedge-range-frame'),
      grass: wavyLines(plotW, plotH, Math.max(3, Math.round(plotW / 46)), 'wedge-range-grass', {
        amplitude: 5,
        segments: 8,
        marginY: 0.04,
      }),
      grain: stippleInRect(plotW, plotH, Math.min(120, Math.round((plotW * plotH) / 1100)), 'wedge-range-grain'),
    };
  }, [width, plotW, plotH]);

  // Only set carries plot — the chart is a read-out of the grid below. Each dot
  // sits at its true carry, sized by power.
  const dots = useMemo(() => {
    const out: { key: string; club: string; row: RowKey; cx: number; cy: number; r: number }[] = [];
    wedges.forEach((club, i) => {
      const cx = colCenterX(i);
      for (const r of ROWS) {
        const v = getValue(club, r.key);
        if (v == null) continue;
        out.push({ key: `${club}-${r.key}`, club, row: r.key, cx, cy: distToY(v), r: r.dotR });
      }
    });
    return out;
  }, [wedges, getValue, colCenterX, distToY]);

  return (
    <View style={[styles.wrap, { height: HEIGHT }]} onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT} style={StyleSheet.absoluteFill}>
          {/* Fairway plate */}
          <Path d={chrome!.frame} fill={colors.fairway} stroke={colors.accent} strokeWidth={1.4} />

          {/* Mown-grass texture (faint), translated into the plot area */}
          <G transform={`translate(${PAD_L} ${PAD_T})`} opacity={0.5}>
            {chrome!.grass.map((d, i) => (
              <Path key={i} d={d} stroke={colors.roughDeep} strokeWidth={1} fill="none" opacity={0.35} />
            ))}
            {chrome!.grain.map((dot, i) => (
              <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={colors.accent} opacity={0.08} />
            ))}
          </G>

          {/* Distance gridlines (range markers) */}
          {gridlines.map((d) => {
            const y = distToY(d);
            return (
              <G key={d} transform={`translate(${PAD_L} ${y})`}>
                <Path
                  d={sketchDividerPath(plotW, `wedge-grid-${d}`, { amplitude: 0.6, segments: 6, y: 0 })}
                  stroke={colors.accent}
                  strokeWidth={1}
                  strokeOpacity={0.2}
                  fill="none"
                />
              </G>
            );
          })}

          {/* Dots — one per set carry, sized by power. The dot whose grid cell
              is being edited fills accent (the selection convention). */}
          {dots.map((dot) => {
            const isSel = selected?.club === dot.club && selected?.row === dot.row;
            return (
              <Circle
                key={dot.key}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill={isSel ? colors.accent : colors.accentPressed}
                stroke={colors.accentOn}
                strokeWidth={isSel ? 2.4 : 1.6}
              />
            );
          })}
        </Svg>
      )}

      {/* Distance axis labels (serif, left margin) */}
      {width > 0 &&
        gridlines.map((d) => (
          <View key={d} pointerEvents="none" style={[styles.yLabel, { top: distToY(d) - 8 }]}>
            <ThemedText style={styles.yLabelText}>{d}</ThemedText>
          </View>
        ))}

      {/* Wedge axis labels (serif, bottom) */}
      {width > 0 &&
        wedges.map((club, i) => (
          <View
            key={club}
            pointerEvents="none"
            style={[styles.xLabel, { left: colCenterX(i) - 24, top: HEIGHT - PAD_B + 6 }]}>
            <ThemedText style={styles.xLabelText}>{club}</ThemedText>
          </View>
        ))}
    </View>
  );
}

export const WedgeRangeChart = memo(WedgeRangeChartImpl);

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      position: 'relative',
    },
    yLabel: {
      position: 'absolute',
      left: 0,
      width: PAD_L - 6,
      alignItems: 'flex-end',
    },
    yLabelText: {
      fontFamily: fonts.serif,
      fontSize: 11,
      color: colors.textMuted,
    },
    xLabel: {
      position: 'absolute',
      width: 48,
      alignItems: 'center',
    },
    xLabelText: {
      fontFamily: fonts.serifBold,
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
