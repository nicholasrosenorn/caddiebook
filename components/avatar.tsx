import { StyleSheet } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useColors } from '@/constants/theme-context';

// The preset icon set for profile avatars — golf + identity glyphs drawn in the
// two-color hand-drawn language (no photo uploads). The stored `avatar` value is
// one of these SF-symbol keys. Keep `DEFAULT_AVATAR` first so it's the fallback.
export const AVATAR_ICONS: IconSymbolName[] = [
  'figure.golf',
  'flag.fill',
  'star.fill',
  'trophy.fill',
  'target',
  'bolt.fill',
  'flame.fill',
  'leaf.fill',
  'sun.max.fill',
  'mountain.2.fill',
];

export const DEFAULT_AVATAR: IconSymbolName = 'figure.golf';

// Resolve a stored avatar string to a known icon, falling back to the default.
export function resolveAvatar(avatar: string | null | undefined): IconSymbolName {
  return avatar && AVATAR_ICONS.includes(avatar as IconSymbolName)
    ? (avatar as IconSymbolName)
    : DEFAULT_AVATAR;
}

// A circular, drawn-frame avatar: accent fill with the icon in the on-accent ink.
export function Avatar({
  avatar,
  size = 96,
  seed,
}: {
  avatar: string | null | undefined;
  size?: number;
  seed?: string;
}) {
  const colors = useColors();
  const name = resolveAvatar(avatar);
  return (
    <SketchSurface
      seed={seed ?? `avatar-${name}`}
      fill={colors.accent}
      stroke={colors.accent}
      radius={size / 2}
      style={[styles.frame, { width: size, height: size }]}>
      <IconSymbol name={name} size={Math.round(size * 0.52)} color={colors.accentOn} />
    </SketchSurface>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
