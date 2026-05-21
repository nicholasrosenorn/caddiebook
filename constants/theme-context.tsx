import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getSetting, setSetting } from '@/db/queries';
import { DEFAULT_THEME_ID, themes, type Palette, type ThemeId } from '@/constants/theme';

const THEME_SETTING_KEY = 'theme';

type ThemeContextValue = {
  themeId: ThemeId;
  palette: Palette;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  palette: themes[DEFAULT_THEME_ID].palette,
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);

  // Hydrate the persisted choice once on mount; ignore unknown/stale ids.
  useEffect(() => {
    getSetting(THEME_SETTING_KEY).then((stored) => {
      if (stored && stored in themes) setThemeId(stored as ThemeId);
    });
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    setSetting(THEME_SETTING_KEY, id).catch((err) =>
      console.error('Failed to persist theme', err),
    );
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themeId, palette: themes[themeId].palette, setTheme }),
    [themeId, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active palette. Use this anywhere a component reads color tokens. */
export function useColors(): Palette {
  return useContext(ThemeContext).palette;
}

/** The active theme id + setter, for the Settings gallery. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
