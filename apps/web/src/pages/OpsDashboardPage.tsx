import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatEgp, ORDER_STATES, type OrderState } from '@3pl/shared';

import { getOpsOverview } from '../api/dashboard';
import { Card, Spinner, Badge } from '../components/ui';
import { OrderStateBadge } from '../components/orders/OrderStateBadge';
import { currentLocale } from '../i18n';

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone ?? ''}`}>{value}</p>
    </Card>
  );
}

function QueueCard({ label, count, to }: { label: string; count: number; to: string }) {
  return (
    <Link to={to}>
      <Card className={`p-4 hover:bg-surface-muted transition ${count > 0 ? 'border-amber-300' : ''}`}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-body">{label}</span>
          <span className={`text-xl font-bold ${count > 0 ? 'text-amber-600' : 'text-faint'}`}>{count}</span>
        </div>
      </Card>
    </Link>
  );
}

export default function OpsDashboardPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const ops = useQuery({ queryKey: ['ops-overview'], queryFn: getOpsOverview, refetchInterval: 30_000 });

  if (ops.isLoading || !ops.data) return <Spinner />;
  const d = ops.data;
  const maxState = Math.max(1, ...ORDER_STATES.map((s) => d.ordersByState[s] ?? 0));
  const alertTotal = d.alerts.lowStock + d.alerts.slaBreaches + d.alerts.failedSpike;

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('ops.title')}</h1>
        <span className="text-xs text-faint">{t('ops.autoRefresh')}</span>
      </div>

      {/* Headline totals */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Stat label={t('ops.activeClients')} value={String(d.totals.activeClients)} />
        <Stat label={t('ops.warehouses')} value={String(d.totals.warehouses)} />
        <Stat label={t('ops.drivers')} value={String(d.totals.drivers)} />
        <Stat label={t('ops.openOrders')} value={String(d.totals.openOrders)} />
        <Stat label={t('ops.todayOrders')} value={String(d.totals.todayOrders)} />
        <Stat label={t('ops.weekOrders')} value={String(d.totals.weekOrders)} />
      </div>

      {/* Alerts */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">{t('ops.activeAlerts')}:</span>
          {alertTotal === 0 ? <Badge tone="green">{t('ops.allClear')}</Badge> : (
            <>
              {d.alerts.lowStock > 0 && <Badge tone="amber">{t('notifications.categories.LOW_STOCK')}: {d.alerts.lowStock}</Badge>}
              {d.alerts.slaBreaches > 0 && <Badge tone="red">{t('notifications.categories.SLA_BREACH')}: {d.alerts.slaBreaches}</Badge>}
              {d.alerts.failedSpike > 0 && <Badge tone="red">{t('notifications.categories.FAILED_DELIVERY_SPIKE')}: {d.alerts.failedSpike}</Badge>}
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Order funnel */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('reports.orderStates')}</h2>
          <div className="space-y-2">
            {ORDER_STATES.map((s: OrderState) => (
              <div key={s} className="flex items-center gap-2">
                <span className="w-28 shrink-0"><OrderStateBadge state={s} /></span>
                <div className="flex-1 bg-surface-muted rounded h-4 overflow-hidden">
                  <div className="h-4 bg-accent/100" style={{ width: `${Math.round(((d.ordersByState[s] ?? 0) / maxState) * 100)}%` }} />
                </div>
                <span className="w-12 text-end tabular-nums">{d.ordersByState[s] ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* COD + queues */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label={t('ops.codCollected')} value={formatEgp(d.cod.collectedPiastres, { locale: egpLoc })} tone="text-green-600" />
            <Stat label={t('ops.walletLiability')} value={formatEgp(d.cod.walletLiabilityPiastres, { locale: egpLoc })} tone="text-amber-600" />
          </div>
          <h2 className="text-sm font-semibold text-muted">{t('ops.actionQueues')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <QueueCard label={t('ops.returnsPending')} count={d.queues.returnsPending} to="/returns" />
            <QueueCard label={t('ops.remittancesPending')} count={d.queues.remittancesPending} to="/remittances" />
            <QueueCard label={t('ops.importsInFlight')} count={d.queues.importsInFlight} to="/imports" />
            <QueueCard label={t('ops.failedShipments')} count={d.queues.failedShipments} to="/shipments" />
          </div>
        </div>
      </div>

      {/* Per-warehouse */}
      <Card>
        <div className="px-6 pt-5 pb-2"><h2 className="text-lg font-semibold">{t('ops.warehouseOps')}</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted border-b border-line">
                <th className="text-start font-medium px-4 py-3">{t('warehouses.code')}</th>
                <th className="text-start font-medium px-4 py-3">{t('warehouses.name')}</th>
                <th className="text-end font-medium px-4 py-3">{t('nav.orders')}</th>
                <th className="text-end font-medium px-4 py-3">{t('ops.availableUnits')}</th>
              </tr>
            </thead>
            <tbody>
              {d.warehouses.map((w) => (
                <tr key={w.code} className="border-b border-line-soft">
                  <td className="px-4 py-3 font-medium" dir="ltr">{w.code}{w.isBonded && <Badge tone="amber">{t('customs.bonded')}</Badge>}</td>
                  <td className="px-4 py-3 text-body">{w.name}</td>
                  <td className="px-4 py-3 text-end">{w.orders}</td>
                  <td className="px-4 py-3 text-end">{w.availableUnits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Courier scorecard */}
      <Card>
        <div className="px-6 pt-5 pb-2"><h2 className="text-lg font-semibold">{t('reports.courierScorecard')}</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted border-b border-line">
                <th className="text-start font-medium px-4 py-3">{t('fleet.carrier')}</th>
                <th className="text-end font-medium px-4 py-3">{t('reports.shipments')}</th>
                <th className="text-end font-medium px-4 py-3">{t('fleet.delivered')}</th>
                <th className="text-end font-medium px-4 py-3">{t('reports.deliveryRate')}</th>
              </tr>
            </thead>
            <tbody>
              {d.couriers.map((c) => (
                <tr key={c.courier} className="border-b border-line-soft">
                  <td className="px-4 py-3">{t(`fleet.couriers.${c.courier}`, c.courier)}</td>
                  <td className="px-4 py-3 text-end">{c.shipments}</td>
                  <td className="px-4 py-3 text-end">{c.delivered}</td>
                  <td className="px-4 py-3 text-end">{c.deliveryRatePct}%</td>
                </tr>
              ))}
              {d.couriers.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-faint">{t('common.noResults')}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
