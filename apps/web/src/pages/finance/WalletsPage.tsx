import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatEgp } from '@3pl/shared';

import { listClients } from '../../api/clients';
import { getStatement, getWallet } from '../../api/finance';
import type { WalletEntryType } from '../../types';
import { Card, Select, Spinner, Badge } from '../../components/ui';
import { currentLocale } from '../../i18n';

const ENTRY_TONE: Record<WalletEntryType, 'green' | 'red' | 'blue' | 'amber'> = {
  COD_CREDIT: 'green', COMMISSION_FEE: 'red', PAYOUT: 'blue', ADJUSTMENT: 'amber',
};

export default function WalletsPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const [clientId, setClientId] = useState('');

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const wallet = useQuery({ queryKey: ['wallet', clientId], queryFn: () => getWallet(clientId), enabled: !!clientId });
  const statement = useQuery({ queryKey: ['statement', clientId], queryFn: () => getStatement(clientId), enabled: !!clientId });

  const fmtDate = (iso: string) => new Intl.DateTimeFormat(egpLoc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(iso));

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">{t('wallets.title')}</h1>

      <Card className="p-4">
        <div className="w-72">
          <Select label={t('orders.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t('orders.selectClient')}</option>
            {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
        </div>
      </Card>

      {clientId && (
        <>
          <Card className="p-6">
            <p className="text-sm text-slate-500">{t('wallets.balance')}</p>
            <p className="text-3xl font-bold mt-1">{wallet.isLoading ? '…' : formatEgp(wallet.data?.balancePiastres ?? 0, { locale: egpLoc })}</p>
          </Card>

          <Card>
            <div className="px-6 pt-5 pb-2"><h2 className="text-lg font-semibold">{t('wallets.statement')}</h2></div>
            {statement.isLoading ? <Spinner /> : statement.data && statement.data.entries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-start font-medium px-4 py-3">{t('audit.when')}</th>
                      <th className="text-start font-medium px-4 py-3">{t('wallets.entryType')}</th>
                      <th className="text-end font-medium px-4 py-3">{t('wallets.amount')}</th>
                      <th className="text-end font-medium px-4 py-3">{t('wallets.running')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.data.entries.map((e) => (
                      <tr key={e.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                        <td className="px-4 py-3"><Badge tone={ENTRY_TONE[e.type]}>{t(`wallets.types.${e.type}`)}</Badge>{e.note && <span className="block text-xs text-slate-400">{e.note}</span>}</td>
                        <td className={`px-4 py-3 text-end ${e.amountPiastres < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatEgp(e.amountPiastres, { locale: egpLoc })}</td>
                        <td className="px-4 py-3 text-end font-medium">{formatEgp(e.runningBalancePiastres, { locale: egpLoc })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="p-6 text-sm text-slate-400">{t('wallets.noActivity')}</p>}
          </Card>
        </>
      )}
    </div>
  );
}
