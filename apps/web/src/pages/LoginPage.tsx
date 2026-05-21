import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';

import { useAuthStore } from '../stores/auth.store';
import * as authApi from '../api/auth';
import { Button, Card, TextField, Alert } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-3">
          <LanguageSwitcher />
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold text-brand-700 mb-1">{t('app.shortTitle')}</h1>
          <p className="text-sm text-slate-500 mb-5">{t('auth.signInPrompt')}</p>

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
