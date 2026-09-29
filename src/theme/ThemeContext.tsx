import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── COLOR TOKENS ───────────────────────────────────────────────────────────

export type Theme = 'dark' | 'light';

export interface ThemeColors {
  // Backgrounds
  bg: string;          // main page background
  bgCard: string;      // card / surface
  bgCardAlt: string;   // slightly elevated card
  bgInput: string;     // input field background
  bgModal: string;     // modal overlay background
  bgPill: string;      // small pill/badge background
  bgNav: string;       // nav bar background

  // Borders
  border: string;
  borderStrong: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;  // text on accent background

  // Brand accent (stays constant)
  accent: string;
  accentSoft: string;
  accentBorder: string;

  // Semantic
  success: string;
  successBg: string;
  error: string;
  errorBg: string;

  // Nav
  navActiveIcon: string;
  navActiveBg: string;
  navInactiveIcon: string;

  // Status bar style
  statusBar: 'light' | 'dark';
}

// ─── DARK THEME ─────────────────────────────────────────────────────────────

export const darkTheme: ThemeColors = {
  bg: '#07080B',
  bgCard: '#0F111A',
  bgCardAlt: '#141724',
  bgInput: '#141724',
  bgModal: '#0D1019',
  bgPill: '#12141F',
  bgNav: 'rgba(15, 17, 26, 0.96)',

  border: '#1D212E',
  borderStrong: '#252A3A',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  accent: '#5B67F6',
  accentSoft: 'rgba(91,103,246,0.12)',
  accentBorder: 'rgba(91,103,246,0.3)',

  success: '#10B981',
  successBg: 'rgba(16,185,129,0.1)',
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.1)',

  navActiveIcon: '#090A0F',
  navActiveBg: '#FFFFFF',
  navInactiveIcon: '#6B7280',

  statusBar: 'light',
};

// ─── LIGHT THEME ────────────────────────────────────────────────────────────

export const lightTheme: ThemeColors = {
  bg: '#F0F2F8',
  bgCard: '#FFFFFF',
  bgCardAlt: '#F7F8FC',
  bgInput: '#EEF1F9',
  bgModal: '#FFFFFF',
  bgPill: '#E8EAF5',
  bgNav: 'rgba(255,255,255,0.97)',

  border: '#DDE1F0',
  borderStrong: '#C8CCE0',

  textPrimary: '#0F1117',
  textSecondary: '#4B5568',
  textMuted: '#8892A4',
  textInverse: '#FFFFFF',

  accent: '#4A56E8',
  accentSoft: 'rgba(74,86,232,0.10)',
  accentBorder: 'rgba(74,86,232,0.25)',

  success: '#059669',
  successBg: 'rgba(5,150,105,0.1)',
  error: '#DC2626',
  errorBg: 'rgba(220,38,38,0.1)',

  navActiveIcon: '#FFFFFF',
  navActiveBg: '#4A56E8',
  navInactiveIcon: '#8892A4',

  statusBar: 'dark',
};

// ─── CONTEXT ────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  theme: Theme;
  colors: ThemeColors;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  colors: darkTheme,
  toggleTheme: () => {},
  isDark: true,
});

const THEME_STORAGE_KEY = 'blink_app_theme_v1';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('dark');

  // Restore persisted theme on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      return next;
    });
  };

  const colors = theme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
