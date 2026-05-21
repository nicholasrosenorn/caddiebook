import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabBarBackground } from '@/components/tab-bar-background';
import { fontFamily, radius, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

const BAR_HEIGHT = 50;
const CAPSULE_PAD = 5;

/**
 * Floating "liquid glass" tab bar with a frosted capsule that slides behind the
 * active tab — Instagram-style. The bar is a rounded pill with side margins; on
 * iOS 26+ the capsule glass merges with the bar glass via GlassContainer, and
 * elsewhere it falls back to a translucent accent capsule over a blurred pill.
 */
export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const tabCount = state.routes.length;
  const [innerWidth, setInnerWidth] = useState(0);
  const tabWidth = innerWidth > 0 ? innerWidth / tabCount : 0;
  const capsuleWidth = Math.max(tabWidth - CAPSULE_PAD * 2, 0);

  const translateX = useSharedValue(0);
  useEffect(() => {
    const target = state.index * tabWidth + CAPSULE_PAD;
    translateX.value = withTiming(target, { duration: 220 });
  }, [state.index, tabWidth, translateX]);

  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

  const capsule = (inner: ReactNode) => (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.capsule,
        { width: capsuleWidth, height: BAR_HEIGHT - CAPSULE_PAD * 2 },
        capsuleStyle,
      ]}>
      {inner}
    </Animated.View>
  );

  return (
    <View
      style={[styles.container, { bottom: insets.bottom + spacing.xs }]}
      onLayout={(e) => setInnerWidth(e.nativeEvent.layout.width)}>
      {liquidGlass ? (
        // Bar glass + sliding capsule glass share one GlassContainer so the two
        // shapes blend (the real liquid-glass morph) instead of stacking.
        <>
          <GlassContainer style={StyleSheet.absoluteFill} spacing={20}>
            <GlassView
              style={[StyleSheet.absoluteFill, styles.barGlass]}
              glassEffectStyle="clear"
            />
            {capsuleWidth > 0 &&
              capsule(
                <GlassView
                  style={styles.capsuleGlass}
                  glassEffectStyle="regular"
                  tintColor={colors.borderStrong + '4D'}
                />,
              )}
          </GlassContainer>
          <View style={styles.outline} pointerEvents="none" />
        </>
      ) : (
        <>
          <TabBarBackground borderRadius={radius.pill} />
          {capsuleWidth > 0 && capsule(<View style={styles.capsuleFallback} />)}
        </>
      )}

      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = (options.title ?? route.name) as string;
          const color = focused ? colors.accent : colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <PlatformPressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPressIn={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              onPress={onPress}
              pressOpacity={0.7}
              style={styles.tab}>
              {options.tabBarIcon?.({ focused, color, size: 26 })}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </PlatformPressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: spacing.md,
      right: spacing.md,
      height: BAR_HEIGHT,
      borderRadius: radius.pill,
    },
    row: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      alignItems: 'center',
    },
    tab: {
      flex: 1,
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    label: {
      fontFamily: fontFamily.serif,
      fontSize: 11,
      letterSpacing: 0.5,
    },
    barGlass: {
      borderRadius: radius.pill,
    },
    outline: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderStrong,
    },
    capsule: {
      position: 'absolute',
      top: CAPSULE_PAD,
      left: 0,
      borderRadius: radius.pill,
      overflow: 'hidden',
    },
    capsuleGlass: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
    },
    capsuleFallback: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.pill,
      // Neutral drawn-line tone — recessed against the bar, works in every theme.
      backgroundColor: colors.borderStrong + '4D',
    },
  });
