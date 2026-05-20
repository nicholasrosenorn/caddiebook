import { Platform, TextStyle } from 'react-native';

export const colors = {
  background: '#F1EBDC',
  surface: '#F7F1E2',
  surfaceAlt: '#EBE3CC',
  border: '#D9CFB5',
  borderStrong: '#B7A98A',
  textPrimary: '#1A1A1A',
  textSecondary: '#5A5346',
  textMuted: '#8E8674',
  accent: '#1B4D3E',
  accentPressed: '#143A2F',
  accentMuted: '#1B4D3E14',
  accentSoft: '#D7DFD3',
  accentOn: '#F1EBDC',
  danger: '#9B3B2E',
  warning: '#B58A2A',
  info: '#4A6B7A',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

export const fontFamily = {
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui',
  })!,
  serif: 'Fraunces_500Medium',
  serifBold: 'Fraunces_700Bold',
};

export const typography = {
  title: {
    fontFamily: fontFamily.serifBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  } satisfies TextStyle,
  subtitle: {
    fontFamily: fontFamily.serif,
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    color: colors.textPrimary,
  } satisfies TextStyle,
  bodyMuted: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    color: colors.textSecondary,
  } satisfies TextStyle,
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    color: colors.textMuted,
    letterSpacing: 1.4,
  } satisfies TextStyle,
  label: {
    fontFamily: fontFamily.serif,
    fontSize: 13,
    lineHeight: 16,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  } satisfies TextStyle,
  display: {
    fontFamily: fontFamily.serifBold,
    fontSize: 56,
    lineHeight: 60,
    color: colors.textPrimary,
  } satisfies TextStyle,
} as const;
