'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'mbe-theme';

// Rutas que SIEMPRE se fuerzan a light porque muestran el logotipo MBE (tinta oscura,
// no se distingue sobre fondo dark): la landing/registro (`/`, `/{locale}`, <=1 segmento)
// y las páginas de autenticación con el mismo header (login, recuperar contraseña).
// Mismo criterio que el script anti-flash de [locale]/layout.tsx.
const FORCED_LIGHT_ROUTES = ['login', 'recuperar-contrasena'];

function isForcedLightPath(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return true;
  return segments.length === 2 && FORCED_LIGHT_ROUTES.includes(segments[1]);
}

/**
 * Lee el tema resuelto por el script inline de <head> (ver [locale]/layout.tsx),
 * que ya corrió de forma síncrona antes de la hidratación de React. Así el primer
 * render de React ya coincide con el DOM real (sin flash y sin warning de hidratación).
 */
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return (window as unknown as { __MBE_THEME__?: Theme }).__MBE_THEME__ === 'light'
    ? 'light'
    : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>(getInitialTheme);
  const pathname = usePathname();
  const isForcedLight = React.useMemo(() => isForcedLightPath(pathname), [pathname]);

  React.useEffect(() => {
    const root = document.documentElement;
    if (isForcedLight) {
      // Landing/registro/login/recuperar-contraseña siempre en light: el logotipo
      // no se distingue en dark.
      root.classList.remove('dark');
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage puede fallar en modo privado/incógnito — el tema simplemente
      // no persiste entre sesiones, pero la app sigue funcionando.
    }
  }, [theme, isForcedLight]);

  const setTheme = React.useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = React.useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    []
  );

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}
