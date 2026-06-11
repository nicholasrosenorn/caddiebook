import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getPref, setPref } from '@/lib/local/prefs';
import {
  DEFAULT_THEME_ID,
  defaultFonts,
  themes,
  type Chrome,
  type FontSet,
  type Palette,
  type ThemeId,
} from '@/constants/theme';

const THEME_SETTING_KEY = 'theme';

type ThemeContextValue = {
  themeId: ThemeId;
  palette: Palette;
  fonts: FontSet;
  chrome: Chrome;
  setTheme: (id: ThemeId) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  palette: themes[DEFAULT_THEME_ID].palette,
  fonts: themes[DEFAULT_THEME_ID].fonts,
  chrome: themes[DEFAULT_THEME_ID].chrome,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  // Hydrate the persisted choice once on mount; ignore unknown/stale ids.
  // Theme is a device preference (and needed before sign-in), so it lives in
  // AsyncStorage rather than the account settings.
  useEffect(() => {
    getPref(THEME_SETTING_KEY).then((stored) => {
      if (stored && stored in themes) setThemeId(stored as ThemeId);
    });
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    setPref(THEME_SETTING_KEY, id).catch((err) => console.error('Failed to persist theme', err));
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const meta = themes[themeId];
    return { themeId, palette: meta.palette, fonts: meta.fonts, chrome: meta.chrome, setTheme };
  }, [themeId, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette. Use this anywhere a component reads color tokens inline. */
export function useColors(): Palette {
  return useContext(ThemeContext).palette;
}

/** The active theme's font families. */
export function useFontSet(): FontSet {
  return useContext(ThemeContext).fonts;
}

/** The active theme's texture mode (`editorial` | `notebook`). */
export function useChrome(): Chrome {
  return useContext(ThemeContext).chrome;
}

/** The active theme id + setter, for the Settings gallery. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * The styling token bundle a `makeStyles` factory consumes. Color + fonts (+ the
 * texture mode, available if a stylesheet needs to branch).
 */
export type Tokens = { colors: Palette; fonts: FontSet; chrome: Chrome };

export function useTokens(): Tokens {
  const { palette, fonts, chrome } = useContext(ThemeContext);
  return useMemo(() => ({ colors: palette, fonts, chrome }), [palette, fonts, chrome]);
}

/**
 * Build a themed StyleSheet from a `({ colors, fonts }: Tokens) => StyleSheet`
 * factory. Replaces the `useMemo(() => makeStyles(useColors()), [colors])` boilerplate.
 */
export function useStyles<T>(factory: (tokens: Tokens) => T): T {
  const tokens = useTokens();
  return useMemo(() => factory(tokens), [tokens, factory]);
}
