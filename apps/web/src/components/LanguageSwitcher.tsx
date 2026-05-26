import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { currentLocale, setLocale } from '../i18n';

export function LanguageSwitcher() {
  // useTranslation subscribes this component to language changes, so it re-renders on toggle.
  useTranslation();
  const locale = currentLocale();

  return (
    <button
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted hover:text-ink hover:bg-surface-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <Languages className="h-[18px] w-[18px]" />
      {locale === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}
