import { Platform, TextStyle } from 'react-native';

/**
 * The full set of color tokens a theme must supply. Every preset is a complete
 * Palette so swapping a theme swaps the whole object — the compiler flags any
 * preset that forgets a token.
 */
export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentPressed: string;
  accentMuted: string;
  accentSoft: string;
  accentOn: string;
  // Soft "course" palette — the beige-greens of the driver/approach targets.
  // Use for warm card/track washes that tie chrome back to the play surfaces.
  fairway: string;
  rough: string;
  roughDeep: string;
  danger: string;
  warning: string;
  info: string;
};

// Deep green on warm paper — the original editorial look.
const pinehurst: Palette = {
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
  fairway: '#E4E2CB',
  rough: '#C0D0AC',
  roughDeep: '#A6BC90',
  danger: '#9B3B2E',
  warning: '#B58A2A',
  info: '#4A6B7A',
};

// Navy ink on cool sand.
const links: Palette = {
  background: '#ECE7D8',
  surface: '#F4EFE0',
  surfaceAlt: '#E1DAC5',
  border: '#D3CAB1',
  borderStrong: '#B0A483',
  textPrimary: '#1A1A1A',
  textSecondary: '#54504A',
  textMuted: '#8B8472',
  accent: '#1F3A5F',
  accentPressed: '#152A45',
  accentMuted: '#1F3A5F14',
  accentSoft: '#CFD8E2',
  accentOn: '#ECE7D8',
  fairway: '#E2E0C9',
  rough: '#B9C7AE',
  roughDeep: '#9FB593',
  danger: '#9B3B2E',
  warning: '#B58A2A',
  info: '#3E6076',
};

// Rust / terracotta ink on bone.
const clay: Palette = {
  background: '#F2EADC',
  surface: '#F8F1E4',
  surfaceAlt: '#EBE0CC',
  border: '#DCD0B8',
  borderStrong: '#BBA98C',
  textPrimary: '#2A1F1A',
  textSecondary: '#5E4F45',
  textMuted: '#917F6E',
  accent: '#8C3A24',
  accentPressed: '#6E2B19',
  accentMuted: '#8C3A2414',
  accentSoft: '#E6D2C2',
  accentOn: '#F2EADC',
  fairway: '#E5E1C8',
  rough: '#C2CFAB',
  roughDeep: '#A8BC8F',
  danger: '#9B3B2E',
  warning: '#B58A2A',
  info: '#4A6B7A',
};

// Near-black ink on cream — the highest-contrast, most neutral set.
const charcoal: Palette = {
  background: '#F4EFE4',
  surface: '#FAF5EA',
  surfaceAlt: '#EAE3D2',
  border: '#DBD3C0',
  borderStrong: '#B9AE94',
  textPrimary: '#1A1A1A',
  textSecondary: '#55504A',
  textMuted: '#8C8576',
  accent: '#2B2B2B',
  accentPressed: '#161616',
  accentMuted: '#2B2B2B14',
  accentSoft: '#D8D4C8',
  accentOn: '#F4EFE4',
  fairway: '#E4E2CB',
  rough: '#C0D0AC',
  roughDeep: '#A6BC90',
  danger: '#9B3B2E',
  warning: '#B58A2A',
  info: '#4A6B7A',
};

// Inverted: light sage ink, text, and outlines on a deep warm-charcoal ground.
const midnight: Palette = {
  background: '#1B211E',
  surface: '#232A26',
  surfaceAlt: '#2C342E',
  border: '#39443D',
  borderStrong: '#6B7A6C',
  textPrimary: '#ECE7D8',
  textSecondary: '#B4B1A4',
  textMuted: '#888574',
  accent: '#A9C49B',
  accentPressed: '#BFD7B2',
  accentMuted: '#A9C49B22',
  accentSoft: '#2E3A30',
  accentOn: '#1B211E',
  fairway: '#33402F',
  rough: '#3E4F38',
  roughDeep: '#4A5C42',
  danger: '#C76B5B',
  warning: '#D6A94E',
  info: '#6FA0B8',
};

export type ThemeId = 'pinehurst' | 'links' | 'clay' | 'charcoal' | 'midnight';

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  hint: string;
  palette: Palette;
  /** Dark-ground theme — flips the status-bar content to light. */
  dark?: boolean;
};

// Order = the order they appear in the Settings gallery.
export const themes: Record<ThemeId, ThemeMeta> = {
  pinehurst: { id: 'pinehurst', label: 'Pinehurst', hint: 'Deep green on warm paper', palette: pinehurst },
  links: { id: 'links', label: 'Links', hint: 'Navy ink on cool sand', palette: links },
  clay: { id: 'clay', label: 'Clay', hint: 'Terracotta on bone', palette: clay },
  charcoal: { id: 'charcoal', label: 'Charcoal', hint: 'Near-black ink on cream', palette: charcoal },
  midnight: { id: 'midnight', label: 'Midnight', hint: 'Light sage on dark', palette: midnight, dark: true },
};

export const THEME_ORDER: ThemeId[] = ['pinehurst', 'links', 'clay', 'charcoal', 'midnight'];
export const DEFAULT_THEME_ID: ThemeId = 'pinehurst';

/**
 * Static default palette. Components read the *active* palette via
 * `useColors()` (see `theme-context`); this export is the build-time fallback
 * for non-React modules and the default theme.
 */
export const colors: Palette = pinehurst;

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
