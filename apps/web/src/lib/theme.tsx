import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState>({ theme: 'dark', toggle: () => undefined });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Dark is the default; only an explicit stored preference overrides it.
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('armory.theme') as Theme | null) ?? 'dark',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('armory.theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = (): ThemeState => useContext(ThemeContext);
