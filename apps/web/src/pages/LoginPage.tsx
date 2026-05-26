import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';

import { useAuthStore } from '../stores/auth.store';
import * as authApi from '../api/auth';
import { Button, Card, TextField, Alert } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { ThemeToggle } from '../components/ThemeToggle';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const loadCurrentUser = useAuthStore((s) => s.loadCurrentUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const tokens = await authApi.login({
        email,
        password,
        mfaCode: mfaRequired ? mfaCode : undefined,
        deviceLabel: navigator.userAgent.slice(0, 80),
      });
      setTokens(tokens.accessToken, tokens.refreshToken);
      await loadCurrentUser();
      navigate(from, { replace: true });
    } catch (err) {
      const ax = err as AxiosError<{ message?: string; mfaRequired?: boolean }>;
      if (ax.response?.data?.mfaRequired) {
        setMfaRequired(true);
        setError(mfaRequired ? t('auth.invalidMfa') : null);
      } else {
        setError(t('auth.invalidCredentials'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Soft brand glow backdrop */}
      <div className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-accent/100/20 blur-3xl" />
      <div className="w-full max-w-sm relative">
        <div className="flex justify-end mb-3 gap-1.5">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
        <Card className="p-7">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white text-lg font-bold">3</span>
            <div>
              <h1 className="text-lg font-bold text-ink leading-tight">{t('app.shortTitle')}</h1>
              <p className="text-xs text-muted">{t('auth.signInPrompt')}</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <TextField
              label={t('auth.email')}
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={mfaRequired}
            />
            <TextField
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mfaRequired}
            />
            {mfaRequired && (
              <TextField
                label={t('auth.mfaCode')}
                inputMode="numeric"
                autoFocus
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
              />
            )}
            {error && <Alert>{error}</Alert>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t('common.pleaseWait') : t('auth.signIn')}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
