import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../stores/theme.store';

export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={t(dark ? 'theme.toLight' : 'theme.toDark')}
      title={t(dark ? 'theme.toLight' : 'theme.toDark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
