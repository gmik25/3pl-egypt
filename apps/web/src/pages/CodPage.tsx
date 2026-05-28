import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatEgp } from '@3pl/shared';

import { listClients } from '../api/clients';
import { getCodSummary, listOrders } from '../api/orders';
import { Card, Select, Spinner, EmptyState, TableSkeleton } from '../components/ui';
import { OrderStateBadge } from '../components/orders/OrderStateBadge';
import { Link } from 'react-router-dom';
import { currentLocale } from '../i18n';

export default function CodPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const [clientId, setClientId] = useState('');

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const summary = useQuery({
    queryKey: ['cod-summary', clientId],
    queryFn: () => getCodSummary(clientId || undefined),
  });
  // COD orders that are delivered (collected) for the per-order view
  const codOrders = useQuery({
    queryKey: ['cod-orders', clientId],
    queryFn: () => listOrders({ clientId: clientId || undefined, state: 'DELIVERED', pageSize: 25 }),
  });

  const Stat = ({ label, piastres, tone }: { label: string; piastres: number; tone?: 'green' | 'blue' | 'amber' }) => (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone === 'green' ? 'text-green-600' : tone === 'amber' ? 'text-amber-600' : 'text-ink'}`}>
        {summary.data ? formatEgp(piastres, { locale: egpLoc }) : '—'}
      </p>
    </Card>
  );

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('cod.title')}</h1>
        <div className="w-64">
          <Select label={t('cod.filterClient')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t('cod.allClients')}</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.legalName}</option>
            ))}
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted">{t('cod.readonlyNote')}</p>

      {summary.isLoading ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t('cod.collected')} piastres={summary.data?.collectedPiastres ?? 0} tone="green" />
          <Stat label={t('cod.remitted')} piastres={summary.data?.remittedPiastres ?? 0} tone="blue" />
          <Stat label={t('cod.adjustments')} piastres={summary.data?.adjustmentsPiastres ?? 0} />
          <Stat label={t('cod.outstanding')} piastres={summary.data?.outstandingPiastres ?? 0} tone="amber" />
        </div>
      )}

      <Card>
        <div className="px-6 pt-5 pb-2">
          <h2 className="text-lg font-semibold">{t('cod.deliveredCodOrders')}</h2>
        </div>
        {codOrders.isLoading ? (
          <TableSkeleton cols={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('orders.reference')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.customer')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.codAmount')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.state')}</th>
                </tr>
              </thead>
              <tbody>
                {codOrders.data?.items
                  .filter((o) => o.paymentMethod === 'COD')
                  .map((o) => (
                    <tr key={o.id} className="border-b border-line-soft hover:bg-surface-muted">
                      <td className="px-4 py-3">
                        <Link to={`/orders/${o.id}`} className="text-accent hover:underline" dir="ltr">{o.reference}</Link>
                      </td>
                      <td className="px-4 py-3 text-body">{o.customerName}</td>
                      <td className="px-4 py-3">{o.codAmountPiastres != null ? formatEgp(o.codAmountPiastres, { locale: egpLoc }) : '—'}</td>
                      <td className="px-4 py-3"><OrderStateBadge state={o.state} /></td>
                    </tr>
                  ))}
                {codOrders.data && codOrders.data.items.filter((o) => o.paymentMethod === 'COD').length === 0 && (
                  <tr><td colSpan={4}><EmptyState icon={Inbox} title={t('common.empty')} hint={t('common.emptyHint')} /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
