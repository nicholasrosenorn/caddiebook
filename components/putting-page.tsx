import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon } from 'react-native-svg';

import { InfoHint } from '@/components/info-hint';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { createPutt, deletePutt } from '@/db/queries';
import type { Hole, Putt } from '@/db/types';
import { roughCirclePath, roughRectPath, stippleInRect } from '@/lib/sketch';

const GLYPH_SIZE = 18;
const LABEL_W = 52;
const FRINGE = 8; // width of the darker fringe band around the board

// Distance bands, ordered far → near so the cup sits at the bottom and you read
// down the line toward the hole. `value` is the stored `distance_ft` bucket.
type Band = { value: number; label: string };
const BANDS: Band[] = [
  { value: 50, label: '25+' },
  { value: 25, label: '15–25' },
  { value: 15, label: '10–15' },
  { value: 10, label: '3–10' },
  { value: 3, label: '<3' },
];

type Props = {
  roundId: string;
  hole: Hole;
  putts: Putt[];
  onChange: () => void | Promise<void>;
};

export function PuttingPage({ roundId, hole, putts, onChange }: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { width: screenWidth } = useWindowDimensions();
  const boardWidth = Math.min(340, screenWidth - 32);

  const totals = useMemo(
    () => ({ made: putts.filter((p) => p.made).length, total: putts.length }),
    [putts],
  );

  const addPutt = async (distance: number, made: boolean) => {
    try {
      await createPutt({ roundId, holeNumber: hole.holeNumber, distanceFt: distance, made });
      await onChange();
    } catch (err) {
      console.error(err);
    }
  };

  const removePutt = async (puttId: string) => {
    try {
      await deletePutt(puttId);
      await onChange();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="caption">PUTTING</ThemedText>
        <ThemedText type="muted" style={styles.totals}>
          {totals.made}/{totals.total} made this round
        </ThemedText>
      </View>

      <View style={styles.boardWrap}>
        <Board
          width={boardWidth}
          putts={putts}
          holeNumber={hole.holeNumber}
          onAdd={addPutt}
          onRemove={removePutt}
        />
      </View>

      <View style={styles.hintRow}>
        <InfoHint
          title="Logging putts"
          message="Each lane is a distance band, ordered far to near with the cup at the bottom. Tap the MADE or MISS column to add a putt at that distance — a filled disc for made, an open ring for missed. Tap a glyph to remove it. The hole's putt count updates automatically."
        />
        <ThemedText type="muted" style={styles.hint}>
          Tap the made or miss side of a distance to log a putt · tap a putt to remove it.
        </ThemedText>
      </View>
    </View>
  );
}

export function Board({
  width,
  putts,
  holeNumber,
  onAdd,
  onRemove,
}: {
  width: number;
  putts: Putt[];
  holeNumber: number;
  onAdd: (distance: number, made: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  // Same beige-green / fringe palette as the approach + driver targets.
  const GREEN_FILL = colors.fairway;
  const FRINGE_GREEN = colors.rough;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w !== size.w || h !== size.h) setSize({ w, h });
  };

  const bg = useMemo(() => {
    if (size.w === 0 || size.h === 0) return null;
    const gw = size.w - FRINGE * 2;
    const gh = size.h - FRINGE * 2;
    return {
      fringe: roughRectPath(size.w, size.h, 18, 'putt-board-fringe'),
      green: roughRectPath(gw, gh, 14, 'putt-board-green'),
      gw,
      gh,
      stipple: stippleInRect(gw, gh, Math.round((gw * gh) / 1400), 'putt-board-grain'),
    };
  }, [size.w, size.h]);

  return (
    <View style={[styles.board, { width }]} onLayout={onLayout}>
      {bg && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path d={bg.fringe} fill={FRINGE_GREEN} stroke={colors.accent} strokeWidth={1.4} strokeOpacity={0.5} />
          <G x={FRINGE} y={FRINGE}>
            <Path d={bg.green} fill={GREEN_FILL} stroke={colors.accent} strokeWidth={1.2} />
            {bg.stipple.map((d, i) => (
              <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={colors.accent} opacity={0.08} />
            ))}
          </G>
        </Svg>
      )}

      <View style={styles.boardInner}>
        {/* Column headers */}
        <View style={styles.headerRow}>
          <View style={styles.labelCol} />
          <View style={styles.headerCell}>
            <PuttGlyph kind="make" seed="hdr-make" />
            <ThemedText style={styles.headerText}>MADE</ThemedText>
          </View>
          <View style={styles.vRule} />
          <View style={styles.headerCell}>
            <PuttGlyph kind="miss" seed="hdr-miss" />
            <ThemedText style={styles.headerText}>MISS</ThemedText>
          </View>
        </View>

        {/* One lane per distance band. Other holes' putts show muted and locked;
            only the current hole's putts are tappable to remove. */}
        {BANDS.map((band, i) => {
          const inBand = (made: boolean) =>
            putts.filter((p) => p.distanceFt === band.value && p.made === made);
          const isCurrent = (p: Putt) => p.holeNumber === holeNumber;
          const made = inBand(true);
          const missed = inBand(false);
          return (
            <View key={band.value} style={[styles.lane, i > 0 && styles.laneDivider]}>
              <View style={styles.labelCol}>
                <ThemedText style={styles.laneLabel}>{band.label}</ThemedText>
                <ThemedText style={styles.laneUnit}>ft</ThemedText>
              </View>
              <PuttZone
                kind="make"
                editable={made.filter(isCurrent)}
                muted={made.filter((p) => !isCurrent(p))}
                onAdd={() => onAdd(band.value, true)}
                onRemove={onRemove}
              />
              <View style={styles.vRule} />
              <PuttZone
                kind="miss"
                editable={missed.filter(isCurrent)}
                muted={missed.filter((p) => !isCurrent(p))}
                onAdd={() => onAdd(band.value, false)}
                onRemove={onRemove}
              />
            </View>
          );
        })}

        {/* The cup, nearest the <3 band
        <View style={styles.cupRow}>
          <Cup />
        </View> */}
      </View>
    </View>
  );
}

function PuttZone({
  kind,
  editable,
  muted,
  onAdd,
  onRemove,
}: {
  kind: 'make' | 'miss';
  editable: Putt[];
  muted: Putt[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const total = editable.length + muted.length;
  return (
    <Pressable onPress={onAdd} style={({ pressed }) => [styles.zone, pressed && styles.zonePressed]}>
      {total === 0 ? null : (
        <View style={styles.glyphWrap}>
          {/* Other holes — shown for context, but locked */}
          {muted.map((p) => (
            <View key={p.id} pointerEvents="none">
              <PuttGlyph kind={kind} seed={p.id} opacity={0.4} />
            </View>
          ))}
          {/* Current hole — tappable to remove */}
          {editable.map((p) => (
            <Pressable
              key={p.id}
              hitSlop={4}
              onPress={() => onRemove(p.id)}
              style={({ pressed }) => pressed && styles.glyphPressed}>
              <PuttGlyph kind={kind} seed={p.id} />
            </Pressable>
          ))}
        </View>
      )}
      {total > 0 && <ThemedText style={styles.zoneCount}>{total}</ThemedText>}
    </Pressable>
  );
}

function PuttGlyph({ kind, seed, opacity = 1 }: { kind: 'make' | 'miss'; seed: string; opacity?: number }) {
  const colors = useColors();
  const c = GLYPH_SIZE / 2;
  const r = GLYPH_SIZE * 0.4;
  const path = roughCirclePath(c, c, r, seed, { jitter: 0.06, points: 14 });
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} opacity={opacity}>
      {kind === 'make' ? (
        <Path d={path} fill={colors.accent} stroke={colors.accent} strokeWidth={1.2} />
      ) : (
        <Path d={path} fill="none" stroke={colors.accent} strokeWidth={2} />
      )}
    </Svg>
  );
}

function Cup() {
  const colors = useColors();
  return (
    <Svg width={36} height={30}>
      {/* flagstick rising out of the <3 band into the cup */}
      <Line x1={18} y1={26} x2={18} y2={4} stroke={colors.accent} strokeWidth={1.4} />
      <Polygon points="18,4 30,8 18,12" fill={colors.accent} />
      {/* the hole */}
      <Path d={roughCirclePath(18, 26, 4, 'putt-cup', { jitter: 0.05 })} fill={colors.accent} />
    </Svg>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.md,
  },
  totals: {
    fontSize: 13,
    marginTop: 2,
  },
  boardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  board: {
    alignSelf: 'center',
    position: 'relative',
  },
  boardInner: {
    paddingHorizontal: FRINGE + 6,
    paddingTop: FRINGE + 4,
    paddingBottom: FRINGE,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
  },
  labelCol: {
    width: LABEL_W,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  headerText: {
    fontFamily: fonts.serif,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.textSecondary,
  },
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  laneDivider: {
    // faint mowing-stripe line between bands
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  laneLabel: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 24,
    color: colors.accent,
  },
  laneUnit: {
    fontFamily: fonts.serif,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: -2,
  },
  vRule: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
    opacity: 0.15,
    marginVertical: 6,
  },
  zone: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  zonePressed: {
    opacity: 0.6,
  },
  glyphWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  glyphPressed: {
    opacity: 0.4,
  },
  zoneCount: {
    position: 'absolute',
    top: 2,
    right: 6,
    fontFamily: fonts.serif,
    fontSize: 11,
    color: colors.accent,
    opacity: 0.45,
  },
  cupRow: {
    alignItems: 'center',
    paddingTop: 4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  hint: {
    flexShrink: 1,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
