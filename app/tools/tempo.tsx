import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useSetSetting, useSettingsMap } from '@/lib/data/settings';

const TEMPOS = [126, 144, 156, 184] as const;
const TEMPO_KEY = 'tempo_bpm';

// One rep over an 8-beat cycle — X _ _ X X _ _ _:
// takeaway (0), top of backswing (3 → 3-beat backswing), impact (4 → 1-beat
// downswing, accented), then a 4-beat rest before the next rep.
const CYCLE_BEATS = 8;
const EVENTS = [
  { beat: 0, tone: 'low' }, // takeaway
  { beat: 3, tone: 'mid' }, // top of backswing
  { beat: 4, tone: 'high' }, // impact (accented)
] as const;

type Tone = (typeof EVENTS)[number]['tone'];

// Pendulum geometry
const SIZE = 240;
const CX = SIZE / 2;
const PIVOT_Y = 36;
const ARM_LEN = 168;
const BOB_R = 16;
const MAX_DEG = 150; // address (impact) at 0°, top of backswing at MAX_DEG

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function TempoScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [bpm, setBpm] = useState<number>(144);
  const [running, setRunning] = useState(false);
  const settings = useSettingsMap();
  const setSetting = useSetSetting();

  const low = useAudioPlayer(require('@/assets/audio/tempo-low.wav'));
  const mid = useAudioPlayer(require('@/assets/audio/tempo-mid.wav'));
  const high = useAudioPlayer(require('@/assets/audio/tempo-high.wav'));

  // progress: 0 = address/impact, 1 = top of backswing
  const progress = useSharedValue(0);
  const flash = useSharedValue(0);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAt = useRef(0);
  const eventIdx = useRef(0);
  const bpmRef = useRef(bpm);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(
      () => {},
    );
  }, []);

  const fire = useCallback(
    (tone: Tone) => {
      const isAccent = tone === 'high';
      const p = tone === 'low' ? low : tone === 'mid' ? mid : high;
      // seekTo is async: rewind to the start *then* play. Calling play()
      // before the seek resolves replays from the clip's end (parked there
      // after the previous hit) → silent. This is the intermittent drop.
      p.seekTo(0)
        .then(() => p.play())
        .catch(() => {});
      flash.value = withSequence(
        withTiming(isAccent ? 1 : 0.5, { duration: 50 }),
        withTiming(0, { duration: 170 }),
      );
      if (isAccent) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },
    [low, mid, high, flash],
  );

  // Drift-corrected scheduler: each tone's time is computed as an absolute
  // offset from the start, so timer jitter never accumulates. Events step
  // through the 8-beat cycle (X _ _ X X _ _ _) and wrap to the next rep.
  const scheduleNext = useCallback(() => {
    const beat = 60000 / bpmRef.current;
    const cycle = CYCLE_BEATS * beat;
    const j = eventIdx.current;
    const rep = Math.floor(j / EVENTS.length);
    const e = EVENTS[j % EVENTS.length];
    const target = startAt.current + rep * cycle + e.beat * beat;
    const delay = Math.max(0, target - Date.now());
    timer.current = setTimeout(() => {
      fire(e.tone);
      eventIdx.current += 1;
      scheduleNext();
    }, delay);
  }, [fire]);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    cancelAnimation(progress);
    progress.value = withTiming(0, { duration: 150 });
    setRunning(false);
  }, [progress]);

  const start = useCallback(
    (nextBpm: number) => {
      if (timer.current) clearTimeout(timer.current);
      bpmRef.current = nextBpm;
      const beat = 60000 / nextBpm;
      startAt.current = Date.now();
      eventIdx.current = 0;
      progress.value = 0;
      progress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 3 * beat, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: beat, easing: Easing.in(Easing.quad) }),
          withTiming(0, { duration: 4 * beat }), // 4-beat rest, arm parked at address
        ),
        -1,
        false,
      );
      setRunning(true);
      scheduleNext();
    },
    [progress, scheduleNext],
  );

  // Hydrate the saved tempo from the cached settings; stop the trainer when
  // leaving the screen.
  const savedTempo = settings.data?.[TEMPO_KEY];
  useEffect(() => {
    const n = Number(savedTempo);
    if ((TEMPOS as readonly number[]).includes(n)) setBpm(n);
  }, [savedTempo]);

  useFocusEffect(
    useCallback(() => {
      return () => stop();
    }, [stop]),
  );

  const onSelect = (v: number) => {
    setBpm(v);
    void setSetting(TEMPO_KEY, String(v));
    if (running) start(v);
  };

  const armProps = useAnimatedProps(() => ({ rotation: progress.value * MAX_DEG }));
  const flashProps = useAnimatedProps(() => ({ opacity: flash.value }));

  const beat = 60000 / bpm;
  const backMs = Math.round(3 * beat);
  const downMs = Math.round(beat);

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.stage}>
          <Svg width={SIZE} height={SIZE}>
            {/* sweep arc guide */}
            <Circle
              cx={CX}
              cy={PIVOT_Y}
              r={ARM_LEN}
              stroke={colors.border}
              strokeWidth={1}
              strokeDasharray="3 6"
              fill="none"
            />
            {/* impact flash at address (bottom) */}
            <AnimatedCircle
              cx={CX}
              cy={PIVOT_Y + ARM_LEN}
              r={BOB_R + 10}
              fill={colors.accent}
              animatedProps={flashProps}
            />
            <AnimatedG originX={CX} originY={PIVOT_Y} animatedProps={armProps}>
              <Line
                x1={CX}
                y1={PIVOT_Y}
                x2={CX}
                y2={PIVOT_Y + ARM_LEN}
                stroke={colors.accent}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <Circle cx={CX} cy={PIVOT_Y + ARM_LEN} r={BOB_R} fill={colors.accent} />
            </AnimatedG>
            {/* pivot */}
            <Circle cx={CX} cy={PIVOT_Y} r={5} fill={colors.background} stroke={colors.accent} strokeWidth={2} />
          </Svg>
        </View>

        <View style={styles.readout}>
          <ThemedText style={styles.bpm}>{bpm}</ThemedText>
          <ThemedText type="caption">3 : 1 TEMPO</ThemedText>
        </View>

        <View style={styles.chips}>
          {TEMPOS.map((v) => {
            const sel = v === bpm;
            return (
              <Pressable key={v} onPress={() => onSelect(v)} accessibilityRole="button">
                <SketchSurface
                  seed={`tempo-${v}`}
                  radius={999}
                  fill={sel ? colors.accent : colors.surface}
                  stroke={sel ? colors.accent : colors.borderStrong}
                  grain={sel}
                  style={styles.chip}>
                  <ThemedText style={[styles.chipLabel, sel && styles.chipLabelSel]}>{v}</ThemedText>
                </SketchSurface>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => (running ? stop() : start(bpm))}
          accessibilityRole="button"
          accessibilityLabel={running ? 'Stop' : 'Start'}>
          <SketchSurface
            seed="tempo-play"
            radius={999}
            fill={running ? colors.surface : colors.accent}
            stroke={colors.accent}
            style={styles.play}>
            <IconSymbol
              name={running ? 'stop.fill' : 'play.fill'}
              size={22}
              color={running ? colors.accent : colors.accentOn}
            />
            <ThemedText style={[styles.playLabel, !running && styles.playLabelOn]}>
              {running ? 'Stop' : 'Start'}
            </ThemedText>
          </SketchSurface>
        </Pressable>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  readout: {
    alignItems: 'center',
    gap: 2,
  },
  bpm: {
    fontFamily: fonts.serifBold,
    fontSize: 56,
    color: colors.textPrimary,
    lineHeight: 60,
  },
  timing: {
    fontSize: 12,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    minWidth: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  chipLabelSel: {
    color: colors.accentOn,
  },
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  playLabel: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.accent,
  },
  playLabelOn: {
    color: colors.accentOn,
  },
});
