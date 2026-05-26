import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';

import { lookupOrderForReturn, submitPortalReturn } from '../api/returns';
import type { PortalLookup, ReturnReason } from '../types';
import { Button, Card, TextField, Select, Alert } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

const REASONS: ReturnReason[] = ['DAMAGED', 'WRONG_ITEM', 'CUSTOMER_REFUSAL', 'CHANGE_OF_MIND'];

export default function ReturnPortalPage() {
  const { t } = useTranslation();
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [lookup, setLookup] = useState<PortalLookup | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnReason>('CHANGE_OF_MIND');
  const [note, setNote] = useState('');
  const [rma, setRma] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doLookup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await lookupOrderForReturn(reference.trim(), phone.trim());
      setLookup(res);
      setQty(Object.fromEntries(res.items.map((i) => [i.skuId, 0])));
    } catch (err) {
      setError((err as AxiosError<{ message?: string }>).response?.data?.message ?? t('portalReturn.lookupError'));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const items = Object.entries(qty).filter(([, q]) => q > 0).map(([skuId, quantity]) => ({ skuId, quantity }));
    if (items.length === 0) { setError(t('portalReturn.selectItems')); return; }
    setBusy(true);
    try {
      const res = await submitPortalReturn({ orderReference: lookup!.orderReference, customerPhone: phone.trim(), reason, customerNote: note || undefined, items });
      setRma(res.rmaNumber);
    } catch (err) {
      setError((err as AxiosError<{ message?: string }>).response?.data?.message ?? t('portalReturn.submitError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-muted flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-3"><LanguageSwitcher /></div>
        <Card className="p-6">
          <h1 className="text-xl font-bold text-accent mb-1">{t('portalReturn.title')}</h1>
          <p className="text-sm text-muted mb-5">{t('portalReturn.subtitle')}</p>

          {rma ? (
            <Alert tone="green">{t('portalReturn.success', { rma })}</Alert>
          ) : !lookup ? (
            <form onSubmit={doLookup} className="space-y-4">
              <TextField label={t('portalReturn.orderReference')} required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="3PL-…" />
              <TextField label={t('orders.phone')} required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+201001234567" />
              {error && <Alert>{error}</Alert>}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? t('common.pleaseWait') : t('portalReturn.findOrder')}</Button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-body">{t('portalReturn.hello', { name: lookup.customerName })}</p>
              <div className="space-y-2">
                {lookup.items.map((it) => (
                  <div key={it.skuId} className="flex items-center justify-between border border-line rounded px-3 py-2 text-sm">
                    <span>{it.nameAr} <span className="text-faint" dir="ltr">({it.code})</span></span>
                    <Select aria-label={it.code} value={String(qty[it.skuId] ?? 0)} onChange={(e) => setQty((m) => ({ ...m, [it.skuId]: Number(e.target.value) }))} className="w-20">
                      {Array.from({ length: it.quantity + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  </div>
                ))}
              </div>
              <Select label={t('portalReturn.reason')} value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
                {REASONS.map((rsn) => <option key={rsn} value={rsn}>{t(`returns.reasons.${rsn}`)}</option>)}
              </Select>
              <TextField label={t('portalReturn.note')} value={note} onChange={(e) => setNote(e.target.value)} />
              {error && <Alert>{error}</Alert>}
              <Button type="submit" className="w-full" disabled={busy}>{busy ? t('common.pleaseWait') : t('portalReturn.submit')}</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
