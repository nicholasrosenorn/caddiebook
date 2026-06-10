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

// Black ink on warm white — a press / broadsheet editorial set.
const charcoal: Palette = {
  background: '#FCFBF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F0EA',
  border: '#E6E3DB',
  borderStrong: '#CDC8BC',
  textPrimary: '#1A1A1A',
  textSecondary: '#55504A',
  textMuted: '#8C8576',
  accent: '#232323',
  accentPressed: '#111111',
  accentMuted: '#23232314',
  accentSoft: '#E2DFD7',
  accentOn: '#FCFBF8',
  fairway: '#E9E7DD',
  rough: '#C2CFB6',
  roughDeep: '#A7BC97',
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

// Pine green on a cool near-white page — the crisp editorial default (Augusta).
const augusta: Palette = {
  background: '#FAF9F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EFE9',
  border: '#E4E1D8',
  borderStrong: '#C9C4B6',
  textPrimary: '#1A1A1A',
  textSecondary: '#55524A',
  textMuted: '#8C8676',
  accent: '#00563B',
  accentPressed: '#003D2C',
  accentMuted: '#103D2C12',
  accentSoft: '#DCE5DE',
  accentOn: '#FAF9F5',
  fairway: '#E9E7DD',
  rough: '#C2CFB6',
  roughDeep: '#A7BC97',
  danger: '#9B3B2E',
  warning: '#B58A2A',
  info: '#4A6B7A',
};

export const fontFamily = {
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'system-ui',
  })!,
  serif: 'Fraunces_500Medium',
  serifBold: 'Fraunces_700Bold',
};

/** Texture identity: crisp hairline "editorial" vs the warm hand-drawn "notebook". */
export type Chrome = 'editorial' | 'notebook';

/** Per-theme font families (loaded family-name strings). */
export type FontSet = {
  body: string;
  serif: string;
  serifBold: string;
};

/** Build-time fallback font set (Fraunces + system sans). */
export const defaultFonts: FontSet = {
  body: fontFamily.sans,
  serif: fontFamily.serif,
  serifBold: fontFamily.serifBold,
};

// A press / Scotch serif — high legibility, editorial authority.
const newsreader: FontSet = {
  body: fontFamily.sans,
  serif: 'Newsreader_500Medium',
  serifBold: 'Newsreader_600SemiBold',
};

// A calm literary serif — quiet and refined.
const spectral: FontSet = {
  body: fontFamily.sans,
  serif: 'Spectral_500Medium',
  serifBold: 'Spectral_600SemiBold',
};

// Libre Baskerville — a warm, classical Baskerville (in the spirit of New Baskerville).
const baskerville: FontSet = {
  body: fontFamily.sans,
  serif: 'LibreBaskerville_500Medium',
  serifBold: 'LibreBaskerville_700Bold',
};

export type ThemeId = 'augusta' | 'charcoal' | 'links' | 'clay' | 'midnight' | 'pinehurst';

export type ThemeMeta = {
  id: ThemeId;
  label: string;
  hint: string;
  palette: Palette;
  /** Type identity — the serif/body families this theme renders in. */
  fonts: FontSet;
  /** Texture identity — crisp editorial chrome or the hand-drawn notebook. */
  chrome: Chrome;
  /** Dark-ground theme — flips the status-bar content to light. */
  dark?: boolean;
};

// Order = the order they appear in the Settings gallery. Each theme is a full
// identity: color palette + font set + chrome (crisp editorial vs hand-drawn
// notebook). Ids are stable so a user's saved choice survives a relabel.
export const themes: Record<ThemeId, ThemeMeta> = {
  augusta: { id: 'augusta', label: 'Pine', hint: 'Pine green on near-white', palette: augusta, fonts: baskerville, chrome: 'editorial' },
  charcoal: { id: 'charcoal', label: 'Broadsheet', hint: 'Black ink on warm white', palette: charcoal, fonts: newsreader, chrome: 'editorial' },
  links: { id: 'links', label: 'Links', hint: 'Navy on cool sand', palette: links, fonts: spectral, chrome: 'editorial' },
  clay: { id: 'clay', label: 'Clay', hint: 'Terracotta on bone', palette: clay, fonts: newsreader, chrome: 'editorial' },
  midnight: { id: 'midnight', label: 'Twilight', hint: 'Sage on charcoal', palette: midnight, fonts: spectral, chrome: 'editorial', dark: true },
  pinehurst: { id: 'pinehurst', label: 'Field Notebook', hint: 'Hand-drawn green on cream', palette: pinehurst, fonts: baskerville, chrome: 'notebook' },
};

export const THEME_ORDER: ThemeId[] = ['charcoal', 'augusta', 'links', 'clay', 'midnight', 'pinehurst'];
export const DEFAULT_THEME_ID: ThemeId = 'charcoal';

/**
 * Static default palette. Components read the *active* palette via
 * `useColors()` (see `theme-context`); this export is the build-time fallback
 * for non-React modules and the default theme.
 */
export const colors: Palette = augusta;

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

/**
 * Typography is a factory so the active theme's font set is injected at runtime.
 * Sizes / leading / tracking are constant; the color is applied by `ThemedText`.
 */
export const makeTypography = (fonts: FontSet): Record<string, TextStyle> => ({
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    lineHeight: 40,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 28,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  bodyMuted: {
    fontFamily: fonts.body,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 14,
    letterSpacing: 1.4,
  },
  label: {
    fontFamily: fonts.serif,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
  },
  display: {
    fontFamily: fonts.serifBold,
    fontSize: 56,
    lineHeight: 68,
  },
});

/** Static default typography (Fraunces); `ThemedText` builds a themed copy at runtime. */
export const typography = makeTypography(defaultFonts);
