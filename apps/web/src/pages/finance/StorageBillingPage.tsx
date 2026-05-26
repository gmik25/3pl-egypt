import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { formatEgp } from '@3pl/shared';

import { listClients } from '../../api/clients';
import { previewStorageBilling, chargeStorageBilling } from '../../api/finance';
import type { StorageBillingPreview } from '../../types';
import { Button, Card, Select, TextField, Spinner, Alert } from '../../components/ui';
import { currentLocale } from '../../i18n';

function monthDefaults() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(first), end: iso(last) };
}

export default function StorageBillingPage() {
  const { t } = useTranslation();
  const egpLoc = currentLocale() === 'ar' ? 'ar-EG' : 'en-EG';
  const def = monthDefaults();
  const [clientId, setClientId] = useState('');
  const [periodStart, setPeriodStart] = useState(def.start);
  const [periodEnd, setPeriodEnd] = useState(def.end);
  const [preview, setPreview] = useState<StorageBillingPreview | null>(null);
  const [charged, setCharged] = useState(false);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ isActive: true, pageSize: 200 }) });
  const egp = (p: number) => formatEgp(p, { locale: egpLoc });

  const doPreview = useMutation({
    mutationFn: () => previewStorageBilling(clientId, periodStart, periodEnd),
    onSuccess: (p) => { setPreview(p); setCharged(false); },
  });
  const doCharge = useMutation({
    mutationFn: () => chargeStorageBilling(clientId, periodStart, periodEnd),
    onSuccess: (p) => { setPreview(p); setCharged(true); },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('storageBilling.title')}</h1>
        <p className="text-sm text-muted">{t('storageBilling.subtitle')}</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select label={t('storageBilling.seller')} value={clientId} onChange={(e) => { setClientId(e.target.value); setPreview(null); }}>
            <option value="">—</option>
            {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
          <TextField label={t('storageBilling.periodStart')} type="date" value={periodStart} onChange={(e) => { setPeriodStart(e.target.value); setPreview(null); }} dir="ltr" />
          <TextField label={t('storageBilling.periodEnd')} type="date" value={periodEnd} onChange={(e) => { setPeriodEnd(e.target.value); setPreview(null); }} dir="ltr" />
        </div>
        <Button disabled={!clientId || doPreview.isPending} onClick={() => doPreview.mutate()}>
          {doPreview.isPending ? t('common.pleaseWait') : t('storageBilling.preview')}
        </Button>
        {doPreview.isError && <Alert>{t('storageBilling.error')}</Alert>}
      </Card>

      {doPreview.isPending ? <Spinner /> : preview && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('storageBilling.estimate')}</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted">{t('storageBilling.reservedBins')}</dt><dd>{preview.reservedBins}</dd></div>
            <div><dt className="text-muted">{t('storageBilling.ratePerBin')}</dt><dd>{egp(preview.ratePerBinPerDayPiastres)}/{t('storageBilling.day')}</dd></div>
            <div><dt className="text-muted">{t('storageBilling.days')}</dt><dd>{preview.days}</dd></div>
            <div><dt className="text-muted">{t('storageBilling.utilization')}</dt><dd>{preview.reservedCapacity > 0 ? `${preview.storedUnits}/${preview.reservedCapacity}` : '—'}</dd></div>
          </dl>
          <div className="border-t border-line-soft pt-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted">{t('storageBilling.net')}</span><span>{egp(preview.netPiastres)}</span></div>
            <div className="flex justify-between"><span className="text-muted">{t('storageBilling.vat')}</span><span>{egp(preview.vatPiastres)}</span></div>
            <div className="flex justify-between font-semibold"><span>{t('storageBilling.gross')}</span><span>{egp(preview.grossPiastres)}</span></div>
          </div>
          {charged ? (
            <Alert tone="green">{t('storageBilling.charged')}</Alert>
          ) : (
            <>
              {doCharge.isError && <Alert>{t('storageBilling.chargeError')}</Alert>}
              <Button disabled={preview.grossPiastres <= 0 || doCharge.isPending} onClick={() => doCharge.mutate()}>
                {doCharge.isPending ? t('common.pleaseWait') : t('storageBilling.charge')}
              </Button>
              <p className="text-xs text-faint">{t('storageBilling.chargeNote')}</p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
