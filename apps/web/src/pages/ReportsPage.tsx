import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatEgp, ORDER_STATES, type OrderState } from '@3pl/shared';

import {
  downloadCsv,
  getCourierScorecard,
  getInventoryReport,
  getOpsKpis,
  getRevenuePerClient,
} from '../api/reports';
import { Inbox } from 'lucide-react';
import { Button, Card, TextField, Spinner, TableSkeleton, EmptyState } from '../components/ui';
import { OrderStateBadge } from '../components/orders/OrderStateBadge';
import { currentLocale } from '../i18n';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-faint mt-1">{sub}</p>}
    </Card>
  );
}

function Bar({ label, value, max, tone = 'bg-accent/100' }: { label: string; value: number; max: number; tone?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-32 shrink-0 truncate text-body">{label}</span>
      <div className="flex-1 bg-surface-muted rounded h-4 overflow-hidden">
        <div className={`h-4 ${tone}`} style={{ width: `${w}%` }} />
      </div>
      <span className="w-12 text-end tabular-nums">{value}</span>
    </div>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const range = { from: new Date(from).toISOString(), to: new Date(to + 'T23:59:59').toISOString() };
  const kpis = useQuery({ queryKey: ['rep-kpis', range], queryFn: () => getOpsKpis(range) });
  const revenue = useQuery({ queryKey: ['rep-revenue', range], queryFn: () => getRevenuePerClient(range) });
  const couriers = useQuery({ queryKey: ['rep-couriers', range], queryFn: () => getCourierScorecard(range) });
  const inventory = useQuery({ queryKey: ['rep-inventory'], queryFn: getInventoryReport });

  const maxRevenue = Math.max(1, ...(revenue.data?.map((r) => r.revenuePiastres) ?? [0]));
  const maxStock = Math.max(1, ...(inventory.data?.map((r) => r.availableUnits) ?? [0]));

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
        <Button variant="secondary" onClick={() => window.print()}>{t('reports.print')}</Button>
      </div>

      <Card className="p-4">
        <div className="flex gap-3 items-end flex-wrap">
          <TextField label={t('invoices.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label={t('invoices.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </Card>

      {/* KPI cards */}
      {kpis.isLoading ? <Spinner /> : kpis.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label={t('reports.totalOrders')} value={String(kpis.data.totalOrders)} />
          <Stat label={t('reports.fulfilmentRate')} value={`${kpis.data.fulfilmentRatePct}%`} />
          <Stat label={t('reports.onTime')} value={`${kpis.data.onTimeDeliveryPct}%`} sub={t('reports.measured', { count: kpis.data.onTimeMeasured })} />
          <Stat label={t('reports.codCollection')} value={`${kpis.data.codCollectionRatePct}%`} sub={`${formatEgp(kpis.data.codCollectedPiastres, { locale: egpLoc })} / ${formatEgp(kpis.data.codExpectedPiastres, { locale: egpLoc })}`} />
        </div>
      )}

      {/* Order state breakdown */}
      {kpis.data && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('reports.orderStates')}</h2>
          <div className="space-y-2">
            {ORDER_STATES.map((s: OrderState) => (
              <div key={s} className="flex items-center gap-2">
                <span className="w-28 shrink-0"><OrderStateBadge state={s} /></span>
                <div className="flex-1 bg-surface-muted rounded h-4 overflow-hidden">
                  <div className="h-4 bg-accent/100" style={{ width: `${kpis.data!.totalOrders ? Math.round(((kpis.data!.stateCounts[s] ?? 0) / kpis.data!.totalOrders) * 100) : 0}%` }} />
                </div>
                <span className="w-12 text-end tabular-nums">{kpis.data!.stateCounts[s] ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revenue per client */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t('reports.revenuePerClient')}</h2>
            <Button variant="ghost" onClick={() => downloadCsv('/reports/revenue-per-client.csv', range, 'revenue-per-client.csv')}>{t('reports.exportCsv')}</Button>
          </div>
          {revenue.isLoading ? <Spinner /> : revenue.data && revenue.data.length > 0 ? (
            <div className="space-y-2">
              {revenue.data.slice(0, 10).map((r) => (
                <Bar key={r.client} label={r.client} value={Math.round(r.revenuePiastres / 100)} max={Math.round(maxRevenue / 100)} />
              ))}
            </div>
          ) : <p className="text-sm text-faint">{t('common.noResults')}</p>}
        </Card>

        {/* Inventory by warehouse */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">{t('reports.inventoryByWarehouse')}</h2>
            <Button variant="ghost" onClick={() => downloadCsv('/reports/inventory.csv', {}, 'inventory.csv')}>{t('reports.exportCsv')}</Button>
          </div>
          {inventory.isLoading ? <Spinner /> : inventory.data && inventory.data.length > 0 ? (
            <div className="space-y-2">
              {inventory.data.map((r) => <Bar key={r.warehouse} label={r.warehouse} value={r.availableUnits} max={maxStock} tone="bg-green-500/100" />)}
            </div>
          ) : <p className="text-sm text-faint">{t('common.noResults')}</p>}
        </Card>
      </div>

      {/* Courier scorecard */}
      <Card>
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <h2 className="text-lg font-semibold">{t('reports.courierScorecard')}</h2>
          <Button variant="ghost" onClick={() => downloadCsv('/reports/courier-scorecard.csv', range, 'courier-scorecard.csv')}>{t('reports.exportCsv')}</Button>
        </div>
        {couriers.isLoading ? <TableSkeleton cols={5} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('fleet.carrier')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('reports.shipments')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('fleet.delivered')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('reports.deliveryRate')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('reports.avgAttempts')}</th>
                </tr>
              </thead>
              <tbody>
                {couriers.data?.map((c) => (
                  <tr key={c.courier} className="border-b border-line-soft">
                    <td className="px-4 py-3">{t(`fleet.couriers.${c.courier}`, c.courier)}</td>
                    <td className="px-4 py-3 text-end">{c.shipments}</td>
                    <td className="px-4 py-3 text-end">{c.delivered}</td>
                    <td className="px-4 py-3 text-end">{c.deliveryRatePct}%</td>
                    <td className="px-4 py-3 text-end">{c.avgAttempts}</td>
                  </tr>
                ))}
                {couriers.data?.length === 0 && <tr><td colSpan={5}><EmptyState icon={Inbox} title={t('common.empty')} hint={t('common.emptyHint')} /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
