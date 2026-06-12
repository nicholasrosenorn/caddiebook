import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Paper, SketchDivider } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useRoundFull } from '@/lib/data/rounds';
import { useNeedsClubSetup, useSetupTooltip } from '@/lib/data/settings';
import { GOAL_CATEGORIES } from '@/lib/goals';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const OPEN_MS = 240;
const CLOSE_MS = 190;

type ToolItem = {
  key: string;
  label: string;
  hint: string;
  route?: string;
};

// Order matches the build-out; routeless items render as "Soon".
const ITEMS: ToolItem[] = [
  { key: 'journal', label: 'Journal', hint: 'Swing thoughts, practice, notes', route: '/journal' },
  { key: 'yardages', label: 'Stock yardages', hint: 'Your full carry per club', route: '/tools/yardages' },
  { key: 'wedges', label: 'Wedge grid', hint: 'Full · ¾ · ½ carries', route: '/tools/wedge-grid' },
  { key: 'tempo', label: 'Tempo trainer', hint: '3:1 swing metronome', route: '/tools/tempo' },
];

export default function MenuScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, width * 0.82);
  // When opened from inside a round, the hamburger passes the active round id so
  // the menu can surface that round's goals.
  const { roundId } = useLocalSearchParams<{ roundId?: string }>();
  const { data: roundDetail } = useRoundFull(roundId);
  const goals = roundDetail?.goals ?? null;
  // Gentle nudge to fill out the bag / carry distances — only outside a round.
  const needsSetup = useNeedsClubSetup() && !roundId;

  // Opening the menu means the player found it, so retire the first-login
  // coachmark (the dot itself lingers until they actually visit the yardages).
  const { dismiss: dismissTooltip } = useSetupTooltip();
  useEffect(() => {
    if (!roundId) dismissTooltip();
  }, [roundId, dismissTooltip]);

  // 0 = closed (panel off-screen left, backdrop clear), 1 = fully open.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  // Slide + fade the whole sheet out, then run the navigation so the menu is
  // never torn away mid-transition.
  const closeThen = useCallback(
    (after: () => void) => {
      progress.value = withTiming(
        0,
        { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) scheduleOnRN(after);
        },
      );
    },
    [progress],
  );

  const dismiss = () =>
    closeThen(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/' as any);
    });

  const open = (item: ToolItem) => {
    if (!item.route) return;
    closeThen(() => router.replace(item.route as any));
  };

  const openSettings = () => closeThen(() => router.replace('/settings' as any));

  const openRoundSettings = () => {
    if (!roundId) return;
    closeThen(() => router.replace(`/round/${roundId}/settings?inRound=1` as any));
  };

  const openGoals = () => {
    if (!roundId) return;
    closeThen(() => router.replace(`/round/${roundId}/goals` as any));
  };

  const goalRows = goals
    ? GOAL_CATEGORIES.map((c) => ({ label: c.label, value: goals[c.key] })).filter(
        (r): r is { label: string; value: string } => !!r.value,
      )
    : [];
  const hasGoals = goalRows.length > 0;

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * panelWidth }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View style={styles.root}>
      <AnimatedPressable
        style={[styles.backdrop, backdropStyle]}
        onPress={dismiss}
        accessibilityLabel="Close menu"
      />
      <Animated.View
        style={[
          styles.panel,
          panelStyle,
          { width: panelWidth, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.md },
        ]}>
        <Paper />
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          style={({ pressed }) => [
            styles.close,
            { top: insets.top + spacing.lg },
            pressed && styles.closePressed,
          ]}>
          <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.header}>
          <ThemedText type="caption">CADDIE BOOK</ThemedText>
          <ThemedText style={styles.title}>Tools</ThemedText>
        </View>

        {roundId ? (
          <Pressable
            onPress={openGoals}
            accessibilityRole="button"
            accessibilityLabel={hasGoals ? 'Edit round goals' : 'Set round goals'}
            style={({ pressed }) => [styles.focusCard, pressed && styles.rowPressed]}>
            <View style={styles.focusHeader}>
              <ThemedText type="caption">THIS ROUND&apos;S FOCUS</ThemedText>
              <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
            </View>
            {hasGoals ? (
              <View style={styles.focusList}>
                {goalRows.map((row) => (
                  <View key={row.label} style={styles.focusRow}>
                    <ThemedText style={styles.focusLabel}>{row.label}</ThemedText>
                    <ThemedText style={styles.focusValue}>{row.value}</ThemedText>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText type="muted" style={styles.focusEmpty}>
                Set goals to keep this round focused
              </ThemedText>
            )}
          </Pressable>
        ) : null}

        <View style={styles.list}>
          {ITEMS.map((item, i) => {
            const disabled = !item.route;
            const showNudge = item.key === 'yardages' && needsSetup;
            return (
              <View key={item.key}>
                {i > 0 && <SketchDivider seed={`menu-${item.key}`} />}
                <Pressable
                  onPress={() => open(item)}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  style={({ pressed }) => [styles.row, pressed && !disabled && styles.rowPressed]}>
                  <View style={styles.rowText}>
                    <View style={styles.labelRow}>
                      <ThemedText style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
                        {item.label}
                      </ThemedText>
                      {showNudge ? <View style={styles.nudgeDot} /> : null}
                    </View>
                    <ThemedText type="muted" style={styles.rowHint}>
                      {item.hint}
                    </ThemedText>
                  </View>
                  {disabled ? (
                    <ThemedText style={styles.soon}>SOON</ThemedText>
                  ) : (
                    <IconSymbol name="chevron.right" size={20} color={colors.textMuted} />
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Settings pinned to the bottom — round settings while in a round,
            otherwise global app settings. */}
        <View style={styles.footer}>
          <SketchDivider seed="menu-settings" />
          <Pressable
            onPress={roundId ? openRoundSettings : openSettings}
            accessibilityRole="button"
            accessibilityLabel={roundId ? 'Round settings' : 'Settings'}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.settingsIcon}>
              <IconSymbol name="gearshape" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.rowText}>
              <ThemedText style={styles.rowLabel}>
                {roundId ? 'Round settings' : 'Settings'}
              </ThemedText>
              <ThemedText type="muted" style={styles.rowHint}>
                {roundId ? 'Handicap · sharing · delete' : 'Theme & appearance'}
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: 'row',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#1A1A1A55',
    },
    panel: {
      height: '100%',
      backgroundColor: colors.background,
      borderRightWidth: 1,
      borderRightColor: colors.borderStrong,
      paddingHorizontal: spacing.md,
    },
    close: {
      position: 'absolute',
      right: spacing.md,
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    closePressed: {
      opacity: 0.5,
    },
    header: {
      gap: 2,
      paddingBottom: spacing.lg,
    },
    title: {
      fontFamily: fonts.serifBold,
      fontSize: 20,
      lineHeight: 27,
      color: colors.textPrimary,
      marginTop: 5,
    },
    focusCard: {
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.md,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
    },
    focusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    focusList: {
      gap: spacing.sm,
    },
    focusRow: {
      gap: 1,
    },
    focusLabel: {
      fontFamily: fonts.body,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textMuted,
    },
    focusValue: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textPrimary,
    },
    focusEmpty: {
      fontSize: 13,
    },
    list: {
      gap: 0,
    },
    footer: {
      marginTop: 'auto',
    },
    settingsIcon: {
      width: 28,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    rowPressed: {
      opacity: 0.6,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    nudgeDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
    },
    rowLabel: {
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    rowLabelDisabled: {
      color: colors.textMuted,
    },
    rowHint: {
      fontSize: 12,
    },
    soon: {
      fontFamily: fonts.body,
      fontSize: 10,
      letterSpacing: 1,
      color: colors.textMuted,
    },
  });
