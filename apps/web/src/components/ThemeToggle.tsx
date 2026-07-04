import { useTheme } from '../lib/theme';
import { Button } from './ui';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button variant="ghost" onClick={toggle} aria-label="Toggle color theme" title="Toggle theme">
      {theme === 'dark' ? '☀️' : '🌙'}
    </Button>
  );
}
