import { router } from 'expo-router';
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
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

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
  { key: 'yardages', label: 'Stock yardages', hint: 'Your full carry per club', route: '/tools/yardages' },
  { key: 'wedges', label: 'Wedge grid', hint: 'Full · ¾ · ½ carries', route: '/tools/wedge-grid' },
  { key: 'tempo', label: 'Tempo trainer', hint: '3:1 swing metronome', route: '/tools/tempo' },
];

export default function MenuScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, width * 0.82);

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

        <View style={styles.list}>
          {ITEMS.map((item, i) => {
            const disabled = !item.route;
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
                    <ThemedText style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>
                      {item.label}
                    </ThemedText>
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

        {/* Settings pinned to the bottom of the panel */}
        <View style={styles.footer}>
          <SketchDivider seed="menu-settings" />
          <Pressable
            onPress={openSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.settingsIcon}>
              <IconSymbol name="gearshape" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.rowText}>
              <ThemedText style={styles.rowLabel}>Settings</ThemedText>
              <ThemedText type="muted" style={styles.rowHint}>
                Theme &amp; appearance
              </ThemedText>
            </View>
            <IconSymbol name="chevron.right" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
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
      fontFamily: fontFamily.serifBold,
      fontSize: 20,
      color: colors.textPrimary,
      marginTop: 5,
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
    rowLabel: {
      fontFamily: fontFamily.serif,
      fontSize: 18,
      color: colors.textPrimary,
    },
    rowLabelDisabled: {
      color: colors.textMuted,
    },
    rowHint: {
      fontSize: 12,
    },
    soon: {
      fontFamily: fontFamily.sans,
      fontSize: 10,
      letterSpacing: 1,
      color: colors.textMuted,
    },
  });
