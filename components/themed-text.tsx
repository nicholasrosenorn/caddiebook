import { useMemo } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { makeTypography } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

export type ThemedTextType =
  | 'default'
  | 'title'
  | 'subtitle'
  | 'caption'
  | 'muted'
  | 'label';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
};

// Which themed text color each type wears. Applied over the typography style so
// the type re-colors with the active theme; an explicit `style` from the caller
// still wins (it's applied last).
const TYPE_COLOR = {
  default: 'textPrimary',
  title: 'textPrimary',
  subtitle: 'textPrimary',
  caption: 'textMuted',
  muted: 'textSecondary',
  label: 'textSecondary',
} as const;

export function ThemedText({ style, type = 'default', ...rest }: ThemedTextProps) {
  const colors = useColors();
  const fonts = useFontSet();
  // Rebuild the type ramp from the active theme's fonts (memoized per font set).
  const styles = useMemo(() => {
    const t = makeTypography(fonts);
    return StyleSheet.create({
      default: t.body,
      title: t.title,
      subtitle: t.subtitle,
      caption: t.caption,
      muted: t.bodyMuted,
      label: t.label,
    });
  }, [fonts]);
  return (
    <Text style={[styles[type], { color: colors[TYPE_COLOR[type]] }, style]} {...rest} />
  );
}
