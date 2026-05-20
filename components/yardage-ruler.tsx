import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { colors, fontFamily, spacing } from '@/constants/theme';

type Props = {
  value: number | null;
  onCommit: (next: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
};

const STEP_PX = 12; // horizontal distance between adjacent ticks

// A tap-first horizontal ruler. Flick/drag to a yardage; it snaps to the
// nearest `step` under a fixed center pointer, with a big serif readout.
// When nothing is set yet it starts parked at `defaultValue` (a common yardage)
// so the player just nudges from there — but it doesn't commit until they do.
export function YardageRuler({
  value,
  onCommit,
  min = 0,
  max = 300,
  step = 5,
  defaultValue = 125,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [display, setDisplay] = useState<number>(value ?? defaultValue);
  const touched = useRef(false);

  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);

  const valueFromOffset = (x: number) => {
    const i = Math.round(x / STEP_PX);
    return Math.max(min, Math.min(max, min + i * step));
  };

  // Keep the scroll position in sync when the external value changes (and on
  // first layout), unless the user is mid-interaction.
  useEffect(() => {
    const start = value ?? defaultValue;
    setDisplay(start);
    if (width > 0 && !touched.current) {
      scrollRef.current?.scrollTo({ x: ((start - min) / step) * STEP_PX, animated: false });
    }
  }, [value, width, min, step, defaultValue]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touched.current = true;
    setDisplay(valueFromOffset(e.nativeEvent.contentOffset.x));
  };

  const commit = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = valueFromOffset(e.nativeEvent.contentOffset.x);
    touched.current = false;
    if (next !== value) onCommit(next);
  };

  // Until the player interacts, the readout is a parked suggestion, not a saved
  // value — show it muted so it doesn't read as committed.
  const isUnset = value == null && !touched.current;

  return (
    <SketchSurface seed="yardage-ruler" radius={10} style={styles.surface}>
      <View style={styles.readoutRow}>
        <ThemedText style={[styles.readout, isUnset && styles.readoutMuted]}>
          {display}
        </ThemedText>
        <ThemedText style={styles.unit}>yds</ThemedText>
      </View>

      <View style={styles.track} onLayout={onLayout}>
        {width > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={STEP_PX}
            decelerationRate="fast"
            scrollEventThrottle={16}
            onScroll={onScroll}
            onScrollEndDrag={commit}
            onMomentumScrollEnd={commit}
            contentContainerStyle={{ paddingHorizontal: width / 2 }}>
            {ticks.map((v) => {
              const major = v % 25 === 0;
              const labeled = v % 50 === 0;
              return (
                <View key={v} style={styles.tickCell}>
                  <View style={[styles.tick, major && styles.tickMajor]} />
                  {labeled ? <ThemedText style={styles.tickLabel}>{v}</ThemedText> : null}
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Fixed center pointer */}
        <View pointerEvents="none" style={styles.pointer}>
          <View style={styles.pointerLine} />
        </View>
      </View>
    </SketchSurface>
  );
}

const TRACK_HEIGHT = 46;

const styles = StyleSheet.create({
  surface: {
    paddingVertical: spacing.sm,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
    paddingBottom: 2,
  },
  readout: {
    fontFamily: fontFamily.serifBold,
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 30,
  },
  readoutMuted: {
    color: colors.textMuted,
  },
  unit: {
    fontFamily: fontFamily.serif,
    fontSize: 13,
    color: colors.textSecondary,
  },
  track: {
    height: TRACK_HEIGHT,
    justifyContent: 'center',
  },
  tickCell: {
    width: STEP_PX,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  tick: {
    width: 1,
    height: 10,
    backgroundColor: colors.borderStrong,
  },
  tickMajor: {
    height: 18,
    width: 1.5,
    backgroundColor: colors.accent,
  },
  tickLabel: {
    position: 'absolute',
    top: 20,
    left: -16,
    width: 32,
    textAlign: 'center',
    fontFamily: fontFamily.serif,
    fontSize: 11,
    color: colors.textMuted,
  },
  pointer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pointerLine: {
    width: 2,
    height: 22,
    backgroundColor: colors.accent,
    borderRadius: 1,
  },
});
