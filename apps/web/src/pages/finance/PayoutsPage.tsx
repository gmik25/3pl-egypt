import { Inbox } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { egpToPiastres, formatEgp, PAYOUT_RAILS, type PayoutRail } from '@3pl/shared';

import { listClients } from '../../api/clients';
import { createPayout, listPayouts, markPayoutFailed, markPayoutPaid } from '../../api/finance';
import type { PayoutStatus } from '../../types';
import { Button, Card, Select, TextField, Badge, Alert, TableSkeleton, EmptyState } from '../../components/ui';
import { currentLocale } from '../../i18n';

const TONE: Record<PayoutStatus, 'amber' | 'green' | 'red'> = { PENDING: 'amber', PAID: 'green', FAILED: 'red' };

export default function PayoutsPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const qc = useQueryClient();

  const [clientId, setClientId] = useState('');
  const [amountEgp, setAmountEgp] = useState('');
  const [rail, setRail] = useState<PayoutRail>('INSTAPAY');
  const [error, setError] = useState<string | null>(null);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const payouts = useQuery({ queryKey: ['payouts'], queryFn: () => listPayouts() });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['payouts'] });

  const create = useMutation({
    mutationFn: () => createPayout({ clientId, amountPiastres: egpToPiastres(amountEgp), rail }),
    onSuccess: () => { setAmountEgp(''); setError(null); refresh(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? t('payouts.createError')),
  });
  const paid = useMutation({ mutationFn: (id: string) => markPayoutPaid(id), onSuccess: refresh });
  const failed = useMutation({ mutationFn: (id: string) => markPayoutFailed(id), onSuccess: refresh });

  const submit = (e: FormEvent) => { e.preventDefault(); create.mutate(); };

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">{t('payouts.title')}</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('payouts.create')}</h2>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Select label={t('orders.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t('orders.selectClient')}</option>
            {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
          <TextField label={t('payouts.amountEgp')} inputMode="decimal" value={amountEgp} onChange={(e) => setAmountEgp(e.target.value)} />
          <Select label={t('payouts.rail')} value={rail} onChange={(e) => setRail(e.target.value as PayoutRail)}>
            {PAYOUT_RAILS.map((r) => <option key={r} value={r}>{t(`payouts.rails.${r}`)}</option>)}
          </Select>
          <Button type="submit" disabled={!clientId || !amountEgp || create.isPending}>{t('payouts.create')}</Button>
        </form>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      </Card>

      <Card>
        {payouts.isLoading ? <TableSkeleton cols={6} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('payouts.reference')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.client')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('payouts.amount')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('payouts.rail')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.state')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payouts.data?.map((p) => (
                  <tr key={p.id} className="border-b border-line-soft">
                    <td className="px-4 py-3 font-medium" dir="ltr">{p.reference}</td>
                    <td className="px-4 py-3 text-body">{p.client?.legalName}</td>
                    <td className="px-4 py-3 text-end">{formatEgp(p.amountPiastres, { locale: egpLoc })}</td>
                    <td className="px-4 py-3">{t(`payouts.rails.${p.rail}`)}</td>
                    <td className="px-4 py-3"><Badge tone={TONE[p.status]}>{t(`payouts.statuses.${p.status}`)}</Badge></td>
                    <td className="px-4 py-3 text-end">
                      {p.status === 'PENDING' && (
                        <div className="flex gap-2 justify-end">
                          <Button variant="secondary" disabled={paid.isPending} onClick={() => paid.mutate(p.id)}>{t('payouts.markPaid')}</Button>
                          <Button variant="ghost" disabled={failed.isPending} onClick={() => failed.mutate(p.id)}>{t('payouts.markFailed')}</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {payouts.data?.length === 0 && <tr><td colSpan={6}><EmptyState icon={Inbox} title={t('common.empty')} hint={t('common.emptyHint')} /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
