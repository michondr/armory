// Dark-first palette matching the web app's neutral + emerald look.
export const theme = {
  bg: '#0a0a0a',
  card: '#171717',
  cardBorder: '#262626',
  text: '#f5f5f5',
  textMuted: '#a3a3a3',
  textFaint: '#737373',
  accent: '#10b981',
  accentText: '#ffffff',
  danger: '#ef4444',
  warn: '#f59e0b',
  inputBg: '#0a0a0a',
  inputBorder: '#404040',
} as const;

export type Theme = typeof theme;
