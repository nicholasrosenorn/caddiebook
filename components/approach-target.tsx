import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon } from 'react-native-svg';

import type { TargetPin } from '@/components/driver-target';
import { BunkerBlob, CornerDots, Crosshair } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { colors } from '@/constants/theme';
import { APPROACH_RINGS } from '@/lib/shots';
import { roughCirclePath, stippleInEllipse } from '@/lib/sketch';

const DEFAULT_SIZE = 280;
const PIN_SIZE = 13;

type ApproachTargetProps = {
  pins?: TargetPin[];
  onTap?: (xNorm: number, yNorm: number) => void;
  size?: number;
};

export function ApproachTarget({ pins = [], onTap, size = DEFAULT_SIZE }: ApproachTargetProps) {
  const handlePress = (e: GestureResponderEvent) => {
    if (!onTap) return;
    const x = e.nativeEvent.locationX / size;
    const y = e.nativeEvent.locationY / size;
    onTap(clamp(x), clamp(y));
  };

  const c = size / 2;
  const greenR = size * 0.205;
  const grain = stippleInEllipse(c, c, greenR, greenR, 44, 'approach-green-grain');

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Outer rings (on cream) */}
        {APPROACH_RINGS.map((ring) => {
          const r = ring.maxR * size;
          if (r <= greenR) return null;
          return (
            <Path
              key={`out-${ring.ft}`}
              d={roughCirclePath(c, c, r, `approach-ring-${ring.ft}`, { jitter: 0.025 })}
              stroke={colors.borderStrong}
              strokeWidth={1.2}
              fill="none"
            />
          );
        })}

        {/* The green */}
        <Path
          d={roughCirclePath(c, c, greenR, 'approach-green', { jitter: 0.05 })}
          fill={colors.accent}
        />
        <G>
          {grain.map((dot, i) => (
            <Circle key={i} cx={dot.x} cy={dot.y} r={dot.r} fill={colors.accentOn} opacity={0.18} />
          ))}
        </G>

        {/* Inner contour rings (faint, drawn over the green) */}
        {APPROACH_RINGS.map((ring) => {
          const r = ring.maxR * size;
          if (r > greenR) return null;
          return (
            <Path
              key={`in-${ring.ft}`}
              d={roughCirclePath(c, c, r, `approach-ring-${ring.ft}`, { jitter: 0.04 })}
              stroke={colors.accentOn}
              strokeWidth={1}
              strokeOpacity={0.3}
              fill="none"
            />
          );
        })}

        {/* Pin flag */}
        <Line x1={c} y1={c} x2={c} y2={c - size * 0.14} stroke={colors.accentOn} strokeWidth={1.6} />
        <Polygon
          points={`${c},${c - size * 0.14} ${c + size * 0.07},${c - size * 0.115} ${c},${c - size * 0.09}`}
          fill={colors.accentOn}
        />
        <Circle cx={c} cy={c} r={2} fill={colors.accentOn} />
      </Svg>

      {/* Decorative chrome (taps fall through) */}
      <View style={styles.cornerTL} pointerEvents="none">
        <CornerDots />
      </View>
      <View style={styles.cornerTR} pointerEvents="none">
        <Crosshair />
      </View>
      <View style={styles.bunker} pointerEvents="none">
        <BunkerBlob width={size * 0.2} height={size * 0.13} seed="approach-bunker" rotation={0.5} />
      </View>

      {/* Ring labels */}
      {APPROACH_RINGS.map((ring) => {
        const r = ring.maxR * size;
        const overGreen = r <= greenR;
        return (
          <View
            key={`label-${ring.ft}`}
            pointerEvents="none"
            style={[styles.ringLabel, { top: c - r - 7, left: c - 18, width: 36 }]}>
            <ThemedText
              type="label"
              style={[styles.ringLabelText, overGreen && styles.ringLabelOver]}>
              {ring.ft}
            </ThemedText>
          </View>
        );
      })}

      {/* Tap surface */}
      <Pressable
        disabled={!onTap}
        onPress={handlePress}
        style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
      />

      {/* Shot pins */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {pins.map((pin, i) => (
          <Pin
            key={pin.key ?? i}
            xNorm={pin.xNorm}
            yNorm={pin.yNorm}
            variant={pin.variant ?? 'primary'}
            containerSize={size}
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
  containerSize,
}: {
  xNorm: number;
  yNorm: number;
  variant: 'primary' | 'muted';
  containerSize: number;
}) {
  return (
    <View
      style={[
        styles.pin,
        {
          left: xNorm * containerSize - PIN_SIZE / 2,
          top: yNorm * containerSize - PIN_SIZE / 2,
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
    top: 2,
    left: 2,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  bunker: {
    position: 'absolute',
    bottom: '2%',
    right: '0%',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringLabelText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  ringLabelOver: {
    color: colors.accentOn,
    opacity: 0.7,
  },
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: colors.accentPressed,
    borderWidth: 2,
    borderColor: colors.accentOn,
  },
  pinMuted: {
    opacity: 0.45,
  },
});
