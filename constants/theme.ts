import { Platform, TextStyle } from 'react-native';

export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  accent: '#059669',
  accentPressed: '#047857',
  accentMuted: '#05966914',
  accentSoft: '#D1FAE5',
  accentOn: '#FFFFFF',
  danger: '#DC2626',
  warning: '#F59E0B',
  info: '#0EA5E9',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34, color: colors.textPrimary } satisfies TextStyle,
  subtitle: { fontSize: 18, fontWeight: '600', lineHeight: 24, color: colors.textPrimary } satisfies TextStyle,
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22, color: colors.textPrimary } satisfies TextStyle,
  bodyMuted: { fontSize: 16, fontWeight: '400', lineHeight: 22, color: colors.textSecondary } satisfies TextStyle,
  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16, color: colors.textMuted } satisfies TextStyle,
};

export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui',
});
