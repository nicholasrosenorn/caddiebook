import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoverHero, CoverLockup, heroIn } from '@/components/cover-hero';
import { FirstRunTheme } from '@/components/first-run-theme';
import { spacing } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { revealUp } from '@/lib/motion';

// Long enough for the full cover choreography (plate settles ~650ms, flag
// rises ~830ms, lockup stagger finishes ~800ms), then a beat of stillness.
const HOLD_MS = 2400;
const FADE_MS = 300;

/**
 * The launch splash — the intro cover's hero + wordmark lockup, replayed for a
 * fixed beat on every cold launch while the launch sync runs underneath, then
 * faded out to reveal the already-mounted app. Rendered as an opaque overlay
 * above the Gate (see app/_layout) and, like the intro, pinned to the Augusta
 * theme via FirstRunTheme so it reads as one consistent brand moment.
 */
export function Splash({ onDone }: { onDone: () => void }) {
  const opacity = useSharedValue(1);
  // Once the fade starts, let touches through to the app immediately.
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      opacity.value = withTiming(
        0,
        { duration: FADE_MS, easing: Easing.out(Easing.quad) },
        () => {
          scheduleOnRN(onDone);
        },
      );
    }, HOLD_MS);
    return () => clearTimeout(timer);
  }, [onDone, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.overlay, fadeStyle]}
      pointerEvents={leaving ? 'none' : 'auto'}>
      <FirstRunTheme>
        <SplashContent />
      </FirstRunTheme>
    </Animated.View>
  );
}

function SplashContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Same hero sizing as the intro cover.
  const heroSize = Math.min(232, (windowWidth - spacing.lg * 2) * 0.7);
  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <Animated.View entering={heroIn}>
        <CoverHero size={heroSize} />
      </Animated.View>
      <CoverLockup />
      <Animated.View
        entering={revealUp(6)}
        style={[styles.loadingBar, { bottom: insets.bottom + spacing.xxl }]}>
        <LoadingBar />
      </Animated.View>
    </View>
  );
}

/**
 * A hairline progress rule at the foot of the splash. The fill is purely a
 * visual cue — it sweeps once over the splash's hold so the pause reads as
 * loading, not a hang. Scale-driven (not width) so it animates on the UI
 * thread, with the origin pinned left so it grows like a drawn line.
 */
function LoadingBar() {
  const colors = useColors();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: HOLD_MS,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
      <Animated.View
        style={[styles.barFill, { backgroundColor: colors.accent }, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  loadingBar: {
    position: 'absolute',
    alignSelf: 'center',
  },
  barTrack: {
    width: 120,
    height: 2,
    overflow: 'hidden',
  },
  barFill: {
    ...StyleSheet.absoluteFillObject,
    transformOrigin: 'left',
  },
});
