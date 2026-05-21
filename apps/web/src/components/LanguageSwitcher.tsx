import { useTranslation } from 'react-i18next';
import { currentLocale, setLocale } from '../i18n';

export function LanguageSwitcher() {
  // useTranslation subscribes this component to language changes, so it re-renders on toggle.
  useTranslation();
  const locale = currentLocale();

  return (
    <button
      onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
      className="px-3 py-1.5 rounded-md text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
    >
      {locale === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}
