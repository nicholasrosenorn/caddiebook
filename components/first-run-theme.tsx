import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { themes } from '@/constants/theme';
import { ThemeContext } from '@/constants/theme-context';

/**
 * Scoped theme pin for the first-run screens (intro, sign-in). They render
 * outside the router before a session exists and should read as one crisp
 * editorial sequence regardless of the theme a returning user has chosen, so
 * both are pinned to Augusta. Carries its own SafeAreaProvider since these
 * screens mount outside the app's provider tree.
 */
export function FirstRunTheme({ children }: { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      themeId: themes.augusta.id,
      palette: themes.augusta.palette,
      fonts: themes.augusta.fonts,
      chrome: themes.augusta.chrome,
      setTheme: () => {},
    }),
    [],
  );
  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

// The first-run reveal vocabulary (revealUp / revealRule) lives in
// `lib/motion.ts` alongside the in-app motion register.
