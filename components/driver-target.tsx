import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path } from 'react-native-svg';

import { BunkerBlob, CornerDots } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { colors } from '@/constants/theme';
import { CF_LEFT_EDGE, CF_RIGHT_EDGE } from '@/lib/shots';
import { fairwayPath, wavyLines } from '@/lib/sketch';

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 360;
const PIN_SIZE = 13;

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

  const path = fairwayPath(width, height, 'fairway');
  const grain = wavyLines(width, height, 7, 'fairway-grain', { amplitude: 5 });
  const cfL = width * CF_LEFT_EDGE;
  const cfR = width * CF_RIGHT_EDGE;

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <ClipPath id="fairwayClip">
            <Path d={path} />
          </ClipPath>
        </Defs>

        <Path d={path} fill={colors.surface} stroke={colors.borderStrong} strokeWidth={1.4} />

        <G clipPath="url(#fairwayClip)">
          {grain.map((d, i) => (
            <Path key={i} d={d} stroke={colors.borderStrong} strokeWidth={0.8} strokeOpacity={0.4} fill="none" />
          ))}
          <Line x1={cfL} y1={0} x2={cfL} y2={height} stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />
          <Line x1={cfR} y1={0} x2={cfR} y2={height} stroke={colors.border} strokeWidth={1} strokeDasharray="3 5" />
        </G>

        {/* Tee markers */}
        <Circle cx={width / 2 - 7} cy={height - 16} r={3} fill={colors.borderStrong} />
        <Circle cx={width / 2 + 7} cy={height - 16} r={3} fill={colors.borderStrong} />
      </Svg>

      {/* Decorative bunkers (taps fall through). Tucked against the outer
          edges so they hug the fairway without crossing labels or lanes. */}
      <View style={[styles.bunker, { left: -width * 0.1, top: height * 0.46 }]} pointerEvents="none">
        <BunkerBlob width={width * 0.24} height={height * 0.09} seed="fairway-bunker-l" rotation={1.2} />
      </View>
      <View style={[styles.bunker, { right: -width * 0.1, top: height * 0.24 }]} pointerEvents="none">
        <BunkerBlob width={width * 0.24} height={height * 0.09} seed="fairway-bunker-r" rotation={-0.6} />
      </View>

      <View style={styles.cornerTL} pointerEvents="none">
        <CornerDots />
      </View>

      {/* Yardage marks */}
      <View style={[styles.yardage, { top: height * 0.33 }]} pointerEvents="none">
        <ThemedText type="label" style={styles.yardageText}>200</ThemedText>
      </View>
      <View style={[styles.yardage, { top: height * 0.66 }]} pointerEvents="none">
        <ThemedText type="label" style={styles.yardageText}>100</ThemedText>
      </View>

      {/* Lane labels */}
      <View style={styles.laneLabels} pointerEvents="none">
        <View style={[styles.laneLabel, { width: cfL }]}>
          <ThemedText type="label" style={styles.laneText}>LF</ThemedText>
        </View>
        <View style={[styles.laneLabel, { width: cfR - cfL }]}>
          <ThemedText type="label" style={styles.laneText}>CF</ThemedText>
        </View>
        <View style={[styles.laneLabel, { width: width - cfR }]}>
          <ThemedText type="label" style={styles.laneText}>RF</ThemedText>
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
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  yardageText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  laneLabels: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  laneLabel: {
    alignItems: 'center',
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
