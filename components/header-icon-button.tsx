import { Pressable, View } from 'react-native';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { useColors } from '@/constants/theme-context';

/**
 * Action button for the navigation header bars (menu, settings, community, …).
 *
 * On iOS 26 the system wraps each header button in a liquid-glass capsule that
 * hugs this Pressable. We render a fixed square with the glyph centered so the
 * capsule stays symmetric, then apply a small `opticalOffsetX` to correct SF
 * Symbols whose visible shape sits left of their bounding-box center — without
 * it the icon reads off-center (extra padding on the right) inside the glass.
 * Tune the offset on-device if a particular glyph still looks off.
 */
const OPTICAL_OFFSET_X = 1;

export function HeaderIconButton({
  name,
  onPress,
  accessibilityLabel,
  color,
  badge = false,
  opticalOffsetX = OPTICAL_OFFSET_X,
}: {
  name: IconSymbolName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Defaults to the deep-green ink. */
  color?: string;
  /** Show a small unread dot at the top-right of the glyph. */
  badge?: boolean;
  opticalOffsetX?: number;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={12}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}>
      <View style={{ transform: [{ translateX: opticalOffsetX }] }}>
        <IconSymbol name={name} size={24} color={color ?? colors.accent} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -3,
              width: 9,
              height: 9,
              borderRadius: 4.5,
              backgroundColor: colors.danger,
            }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
