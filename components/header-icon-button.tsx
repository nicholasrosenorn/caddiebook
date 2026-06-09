import { Pressable, View } from 'react-native';

import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { useColors } from '@/constants/theme-context';

/**
 * Action button for the navigation header bars (menu, settings, community, …).
 *
 * On iOS 26 the system wraps each header button in a liquid-glass capsule that
 * hugs this Pressable. We render a fixed square with the glyph centered so the
 * capsule stays symmetric, then apply a tiny per-glyph optical nudge: an SF
 * Symbol's visible ink doesn't always sit at the center of its alignment rect,
 * so a geometrically-centered glyph can still *read* off-center inside the
 * glass (e.g. `gearshape` sits slightly low-and-right). A single global offset
 * can't fix this — each symbol needs its own correction — so we key the nudge
 * off the glyph name. Untuned glyphs get no nudge (neutral). Re-tune on-device.
 */
const OPTICAL_OFFSETS: Partial<Record<IconSymbolName, { x?: number; y?: number }>> = {
  gearshape: { x: -1, y: -1 },
  'line.3.horizontal': { x: 1 },
};

export function HeaderIconButton({
  name,
  onPress,
  accessibilityLabel,
  color,
  badge = false,
  opticalOffsetX,
  opticalOffsetY,
}: {
  name: IconSymbolName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Defaults to the deep-green ink. */
  color?: string;
  /** Show a small unread dot at the top-right of the glyph. */
  badge?: boolean;
  /** Override the per-glyph horizontal optical nudge (pt). */
  opticalOffsetX?: number;
  /** Override the per-glyph vertical optical nudge (pt). */
  opticalOffsetY?: number;
}) {
  const colors = useColors();
  const offset = OPTICAL_OFFSETS[name];
  const translateX = opticalOffsetX ?? offset?.x ?? 0;
  const translateY = opticalOffsetY ?? offset?.y ?? 0;
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
      <View style={{ transform: [{ translateX }, { translateY }] }}>
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
