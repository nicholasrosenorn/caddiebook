import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';
import { CF_LEFT_EDGE, CF_RIGHT_EDGE } from '@/lib/shots';

const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 360;
const PIN_SIZE = 14;

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

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Pressable
        disabled={!onTap}
        onPress={handlePress}
        style={[
          styles.fairway,
          { width, height, borderRadius: width / 2 },
        ]}>
        <View
          pointerEvents="none"
          style={[
            styles.lane,
            styles.laneLeft,
            { left: 0, width: width * CF_LEFT_EDGE },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.lane,
            styles.laneCenter,
            {
              left: width * CF_LEFT_EDGE,
              width: width * (CF_RIGHT_EDGE - CF_LEFT_EDGE),
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.lane,
            styles.laneRight,
            {
              left: width * CF_RIGHT_EDGE,
              width: width * (1 - CF_RIGHT_EDGE),
            },
          ]}
        />

        <View
          style={[styles.divider, { left: width * CF_LEFT_EDGE }]}
          pointerEvents="none"
        />
        <View
          style={[styles.divider, { left: width * CF_RIGHT_EDGE }]}
          pointerEvents="none"
        />

        <View style={[styles.distanceMark, { top: height * 0.35 }]} pointerEvents="none">
          <ThemedText type="caption">200</ThemedText>
        </View>
        <View style={[styles.distanceMark, { top: height * 0.7 }]} pointerEvents="none">
          <ThemedText type="caption">100</ThemedText>
        </View>

        <View
          style={[styles.laneLabel, { left: 0, width: width * CF_LEFT_EDGE }]}
          pointerEvents="none">
          <ThemedText type="caption">LF</ThemedText>
        </View>
        <View
          style={[
            styles.laneLabel,
            {
              left: width * CF_LEFT_EDGE,
              width: width * (CF_RIGHT_EDGE - CF_LEFT_EDGE),
            },
          ]}
          pointerEvents="none">
          <ThemedText type="caption">CF</ThemedText>
        </View>
        <View
          style={[
            styles.laneLabel,
            {
              left: width * CF_RIGHT_EDGE,
              width: width * (1 - CF_RIGHT_EDGE),
            },
          ]}
          pointerEvents="none">
          <ThemedText type="caption">RF</ThemedText>
        </View>
      </Pressable>

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
  },
  fairway: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    position: 'relative',
  },
  lane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  laneLeft: {
    backgroundColor: colors.surfaceAlt,
  },
  laneCenter: {
    backgroundColor: colors.surface,
  },
  laneRight: {
    backgroundColor: colors.surfaceAlt,
  },
  divider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  },
  distanceMark: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  laneLabel: {
    position: 'absolute',
    bottom: spacing.sm,
    alignItems: 'center',
  },
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  pinMuted: {
    backgroundColor: colors.accent,
    opacity: 0.55,
  },
  // unused but referenced from styles? remove if not needed
  _unused: {
    borderRadius: radius.sm,
  },
});
