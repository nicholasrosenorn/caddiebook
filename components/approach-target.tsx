import { Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { colors, spacing } from '@/constants/theme';
import { APPROACH_RINGS } from '@/lib/shots';
import type { TargetPin } from '@/components/driver-target';

const DEFAULT_SIZE = 280;
const PIN_SIZE = 14;
const FLAG_SIZE = 10;

const RING_FILLS = ['#F8FAFC', '#F1F5F9', '#E2E8F0', '#CBD5E1'];

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

  const ringsLargestFirst = [...APPROACH_RINGS].reverse();

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Pressable
        disabled={!onTap}
        onPress={handlePress}
        style={[
          styles.outer,
          { width: size, height: size, borderRadius: size / 2 },
        ]}>
        {ringsLargestFirst.map((ring, idx) => {
          const fillIndex = RING_FILLS.length - 1 - idx;
          const diameter = ring.maxR * 2 * size;
          return (
            <View
              key={ring.ft}
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  width: diameter,
                  height: diameter,
                  borderRadius: diameter / 2,
                  left: size / 2 - diameter / 2,
                  top: size / 2 - diameter / 2,
                  backgroundColor: RING_FILLS[fillIndex],
                },
              ]}
            />
          );
        })}

        {APPROACH_RINGS.map((ring) => {
          const diameter = ring.maxR * 2 * size;
          return (
            <View
              key={`label-${ring.ft}`}
              pointerEvents="none"
              style={[
                styles.ringLabel,
                {
                  left: size / 2 - 18,
                  top: size / 2 - diameter / 2 - 2,
                  width: 36,
                },
              ]}>
              <ThemedText type="caption" style={styles.ringLabelText}>
                {ring.ft} ft
              </ThemedText>
            </View>
          );
        })}

        <View
          pointerEvents="none"
          style={[
            styles.flag,
            {
              left: size / 2 - FLAG_SIZE / 2,
              top: size / 2 - FLAG_SIZE / 2,
              width: FLAG_SIZE,
              height: FLAG_SIZE,
              borderRadius: FLAG_SIZE / 2,
            },
          ]}
        />
      </Pressable>

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
  },
  outer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  ringLabelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  flag: {
    position: 'absolute',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
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
    opacity: 0.55,
  },
});
