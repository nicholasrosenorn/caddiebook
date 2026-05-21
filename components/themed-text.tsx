import { StyleSheet, Text, type TextProps } from 'react-native';

import { typography } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

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

// Which themed text color each type wears. Applied over the static typography
// style so the type re-colors with the active theme; an explicit `style` from
// the caller still wins (it's applied last).
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
  return (
    <Text style={[styles[type], { color: colors[TYPE_COLOR[type]] }, style]} {...rest} />
  );
}

const styles = StyleSheet.create({
  default: typography.body,
  title: typography.title,
  subtitle: typography.subtitle,
  caption: typography.caption,
  muted: typography.bodyMuted,
  label: typography.label,
});
