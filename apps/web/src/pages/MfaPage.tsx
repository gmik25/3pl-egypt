import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';

import * as authApi from '../api/auth';
import { useAuthStore } from '../stores/auth.store';
import { Button, Card, TextField, Alert, Spinner, Badge } from '../components/ui';

export default function MfaPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const loadCurrentUser = useAuthStore((s) => s.loadCurrentUser);

  const [enrollment, setEnrollment] = useState<authApi.MfaEnrollResponse | null>(null);
  const [code, setCode] = useState('');

  const enroll = useMutation({
    mutationFn: authApi.mfaEnroll,
    onSuccess: setEnrollment,
  });

  const verify = useMutation({
    mutationFn: (c: string) => authApi.mfaVerify(c),
    onSuccess: async () => {
      setEnrollment(null);
      setCode('');
      await loadCurrentUser();
    },
  });

  const alreadyEnabled = user?.mfaSecret?.confirmed === true;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('mfa.title')}</h1>
        <p className="text-slate-500 mt-1">{t('mfa.subtitle')}</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">{t('mfa.status')}:</span>
          {alreadyEnabled ? (
            <Badge tone="green">{t('mfa.enabled')}</Badge>
          ) : (
            <Badge tone="amber">{t('mfa.notEnabled')}</Badge>
          )}
        </div>

        {!enrollment && (
          <Button onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            {alreadyEnabled ? t('mfa.reEnroll') : t('mfa.enroll')}
          </Button>
        )}

        {enroll.isPending && <Spinner />}

        {enrollment && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t('mfa.scanInstruction')}</p>
            <div className="flex justify-center bg-white p-4 rounded-md border border-slate-200">
              <QRCodeSVG value={enrollment.otpauthUri} size={180} />
            </div>
            <div className="text-xs text-slate-500">
              {t('mfa.manualEntry')}:{' '}
              <code className="bg-slate-100 px-1 py-0.5 rounded break-all">{enrollment.secret}</code>
            </div>
            <TextField
              label={t('mfa.enterCode')}
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
            {verify.isError && <Alert>{t('auth.invalidMfa')}</Alert>}
            <Button onClick={() => verify.mutate(code)} disabled={verify.isPending || code.length < 6}>
              {verify.isPending ? t('common.pleaseWait') : t('mfa.confirm')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
