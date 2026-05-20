import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { BunkerBlob } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { colors } from '@/constants/theme';
import { CF_LEFT_EDGE, CF_RIGHT_EDGE, FAIRWAY_INSET } from '@/lib/shots';
import { fairwayPath, stippleInEllipse, wavyLines } from '@/lib/sketch';

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 450;
const PIN_SIZE = 13;

// Three nested tones, beige (fairway) → dark green (outer shading).
const FAIRWAY_GREEN = '#E4E2CB';
const ROUGH_GREEN = '#C0D0AC';
const SHADING_GREEN = '#A6BC90';
const ROUGH_INSET = 0.85;

export type TargetPin = {
  xNorm: number;
  yNorm: number;
  key?: string | number;
  variant?: 'primary' | 'muted';
};

type DriverTargetProps = {
  pins?: TargetPin[];
  onTap?: (xNorm: number, yNorm: number) => void;
  width?: number;
  height?: number;
};

export function DriverTarget({
  pins = [],
  onTap,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: DriverTargetProps) {
  const handlePress = (e: GestureResponderEvent) => {
    if (!onTap) return;
    const x = e.nativeEvent.locationX / width;
    const y = e.nativeEvent.locationY / height;
    onTap(clamp(x), clamp(y));
  };

  // One shape, drawn at three insets: fairway (innermost) → rough → outer shading.
  const path = fairwayPath(width, height, 'fairway');
  const grain = wavyLines(width, height, 5, 'fairway-grain', { amplitude: 6 });
  // Sandy stipple texture, like the approach green — fine on the fairway,
  // coarser/sparser over the rough band.
  const fairwayStipple = stippleInEllipse(
    width / 2,
    height / 2,
    width * 0.4,
    height * 0.46,
    54,
    'fairway-stipple',
  );
  const roughStipple = stippleInEllipse(
    width / 2,
    height / 2,
    width * 0.47,
    height * 0.49,
    40,
    'rough-stipple',
  );
  const tf = (s: number) => `translate(${(width * (1 - s)) / 2} ${(height * (1 - s)) / 2}) scale(${s})`;
  const cfL = width * CF_LEFT_EDGE;
  const cfR = width * CF_RIGHT_EDGE;
  const teeY = height * 0.96;

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id="fairwayClip">
            <Path d={path} transform={tf(FAIRWAY_INSET)} />
          </ClipPath>
          <ClipPath id="roughClip">
            <Path d={path} transform={tf(ROUGH_INSET)} />
          </ClipPath>
        </Defs>

        {/* Outer shading — darkest, outermost band */}
        <Path d={path} fill={SHADING_GREEN} stroke={colors.borderStrong} strokeWidth={1} strokeOpacity={0.35} />

        {/* Rough — lightly darker green, clear wider bounding line */}
        <Path d={path} transform={tf(ROUGH_INSET)} fill={ROUGH_GREEN} stroke={colors.accent} strokeWidth={2.4} />

        {/* Coarse stipple over the rough band */}
        <G clipPath="url(#roughClip)">
          {roughStipple.map((dot, i) => (
            <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r * 1.2} fill={colors.accent} opacity={0.12} />
          ))}
        </G>

        {/* Fairway — light green, clear bounding line */}
        <Path d={path} transform={tf(FAIRWAY_INSET)} fill={FAIRWAY_GREEN} stroke={colors.accent} strokeWidth={1.6} />

        {/* Subtle contour lines + fine sandy stipple on the fairway */}
        <G clipPath="url(#fairwayClip)">
          {grain.map((d, i) => (
            <Path key={i} d={d} stroke={colors.accent} strokeWidth={0.8} strokeOpacity={0.14} fill="none" />
          ))}
          {fairwayStipple.map((dot, i) => (
            <Circle key={`s-${i}`} cx={dot.x} cy={dot.y} r={dot.r} fill={colors.accent} opacity={0.16} />
          ))}
        </G>

        {/* Inner beige line just inside the fairway edge */}
        <Path d={path} transform={tf(FAIRWAY_INSET - 0.03)} fill="none" stroke={colors.surface} strokeWidth={1.4} />

        {/* Tee markers */}
        <Rect
          x={width / 2 - 6}
          y={teeY - 9}
          width={12}
          height={18}
          rx={2}
          fill={colors.accent}
          fillOpacity={0.16}
          stroke={colors.accent}
          strokeWidth={1}
          strokeOpacity={0.4}
        />
      </Svg>

      {/* Decorative bunkers (taps fall through). Nestled against the fairway
          edges so they read as flanking hazards, fully inside the frame. */}
      <View style={[styles.bunker, { left: width * 0.08, top: height * 0.45, transform: [{ rotate: '5deg' }] }]} pointerEvents="none">
        <BunkerBlob width={width * 0.12} height={height * 0.17} seed="fairway-bunker-l" />
      </View>
      <View style={[styles.bunker, { right: width * 0.07, top: height * 0.25, transform: [{ rotate: '70deg' }] }]} pointerEvents="none">
        <BunkerBlob width={width * 0.17} height={height * 0.07} seed="fairway-bunker-r" />
      </View>

      {/* <View style={styles.cornerTL} pointerEvents="none">
        <CornerDots />
      </View> */}

      {/* Yardage marks */}
      <View style={[styles.yardage, { top: height * 0.22 }]} pointerEvents="none">
        <ThemedText type="label" style={styles.yardageText}>300</ThemedText>
      </View>
      <View style={[styles.yardage, { top: height * 0.50 }]} pointerEvents="none">
        <ThemedText type="label" style={styles.yardageText}>200</ThemedText>
      </View>
      <View style={[styles.yardage, { top: height * 0.78 }]} pointerEvents="none">
        <ThemedText type="label" style={styles.yardageText}>100</ThemedText>
      </View>

      {/* Lane labels — small paper chips marking the LF / CF / RF scoring zones */}
      <View style={styles.laneLabels} pointerEvents="none">
        <View style={[styles.laneLabel, { width: cfL }]}>
          <View style={styles.laneChip}>
            <ThemedText type="label" style={styles.laneText}>LF</ThemedText>
          </View>
        </View>
        <View style={[styles.laneLabel, { width: cfR - cfL }]}>
          <View style={styles.laneChip}>
            <ThemedText type="label" style={styles.laneText}>CF</ThemedText>
          </View>
        </View>
        <View style={[styles.laneLabel, { width: width - cfR }]}>
          <View style={styles.laneChip}>
            <ThemedText type="label" style={styles.laneText}>RF</ThemedText>
          </View>
        </View>
      </View>

      {/* Tap surface */}
      <Pressable disabled={!onTap} onPress={handlePress} style={StyleSheet.absoluteFill} />

      {/* Shot pins */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pins.map((pin, i) => (
          <Pin
            key={pin.key ?? i}
            xNorm={pin.xNorm}
            yNorm={pin.yNorm}
            variant={pin.variant ?? 'primary'}
            containerWidth={width}
            containerHeight={height}
          />
        ))}
      </View>
    </View>
  );
}

function Pin({
  xNorm,
  yNorm,
  variant,
  containerWidth,
  containerHeight,
}: {
  xNorm: number;
  yNorm: number;
  variant: 'primary' | 'muted';
  containerWidth: number;
  containerHeight: number;
}) {
  return (
    <View
      style={[
        styles.pin,
        {
          left: xNorm * containerWidth - PIN_SIZE / 2,
          top: yNorm * containerHeight - PIN_SIZE / 2,
        },
        variant === 'muted' && styles.pinMuted,
      ]}
    />
  );
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    position: 'relative',
    borderWidth: 0.2,
    borderColor: colors.borderStrong,
  },
  cornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  bunker: {
    position: 'absolute',
  },
  yardage: {
    position: 'absolute',
    left: -30,
    flexDirection: 'row',
    alignItems: 'center',
  },
  yardageText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  laneLabels: {
    position: 'absolute',
    bottom: -25,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  laneLabel: {
    alignItems: 'center',
  },
  laneChip: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  laneText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.accentOn,
  },
  pinMuted: {
    opacity: 0.45,
  },
});
