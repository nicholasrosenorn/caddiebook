import { StyleSheet, Text, type TextProps } from 'react-native';

import { typography } from '@/constants/theme';

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

export function ThemedText({ style, type = 'default', ...rest }: ThemedTextProps) {
  return <Text style={[styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: typography.body,
  title: typography.title,
  subtitle: typography.subtitle,
  caption: typography.caption,
  muted: typography.bodyMuted,
  label: typography.label,
});
