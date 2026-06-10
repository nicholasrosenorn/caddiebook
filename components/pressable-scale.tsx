import * as Haptics from 'expo-haptics';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Pressed scale — 0.97 for buttons; use ~0.98 for large cards. */
  pressedScale?: number;
  /** Light haptic on press-in (iOS only). On by default. */
  haptic?: boolean;
};

/**
 * The app's pressed-state vocabulary: a physical scale-down + a light haptic
 * instead of an opacity dim. Drop-in for Pressable wherever a tap means
 * something.
 */
export function PressableScale({
  style,
  pressedScale = 0.97,
  haptic = true,
  onPressIn,
  ...rest
}: PressableScaleProps) {
  return (
    <Pressable
      {...rest}
      onPressIn={(e) => {
        if (haptic && process.env.EXPO_OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(e);
      }}
      style={({ pressed }) => [style, pressed && { transform: [{ scale: pressedScale }] }]}
    />
  );
}
