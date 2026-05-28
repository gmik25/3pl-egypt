import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatEgp, ORDER_STATES, type OrderState } from '@3pl/shared';

import { getMyContracts } from '../api/portal';
import { getPortalSummary } from '../api/dashboard';
import { Card, Badge, Alert, StatGridSkeleton, CardSkeleton, Skeleton } from '../components/ui';
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

export default function ClientPortalPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';

  const summary = useQuery({ queryKey: ['portal-summary'], queryFn: getPortalSummary });
  const contracts = useQuery({ queryKey: ['portal-contracts'], queryFn: getMyContracts });

  if (summary.isLoading)
    return (
      <div className="max-w-4xl space-y-6">
        <StatGridSkeleton count={4} />
        <CardSkeleton lines={6} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    );
  if (summary.isError) return <div className="max-w-2xl"><Alert tone="amber">{t('portal.notLinked')}</Alert></div>;

  const d = summary.data!;
  const maxState = Math.max(1, ...ORDER_STATES.map((s) => d.ordersByState[s] ?? 0));
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(egpLoc, { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(new Date(iso));

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{d.client.legalName}</h1>
        <p className="text-muted mt-1">{t('portal.subtitle')}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label={t('portalDash.totalOrders')} value={String(d.totalOrders)} />
        <Stat label={t('portalDash.codCollected')} value={formatEgp(d.cod.collectedPiastres, { locale: egpLoc })} tone="text-green-600" />
        <Stat label={t('portalDash.walletBalance')} value={formatEgp(d.cod.walletBalancePiastres, { locale: egpLoc })} tone="text-accent" />
        <Stat label={t('portalDash.openReturns')} value={String(d.returns.open)} />
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Low stock */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('inventory.lowStock')}</h2>
          {d.lowStock.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {d.lowStock.map((r) => (
                <li key={r.code} className="flex items-center justify-between">
                  <span dir="ltr">{r.code} <span className="text-faint">{r.nameAr}</span></span>
                  <Badge tone="red">{r.available} / {r.reorderPointQty}</Badge>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-faint">{t('inventory.noLowStock')}</p>}
        </Card>

        {/* Recent invoices */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('nav.invoices')}</h2>
          {d.recentInvoices.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {d.recentInvoices.map((inv) => (
                <li key={inv.reference} className="flex items-center justify-between">
                  <span dir="ltr">{inv.reference} <span className="text-faint">{fmtDate(inv.periodEnd)}</span></span>
                  <span className="flex items-center gap-2">
                    <span>{formatEgp(inv.grossPiastres, { locale: egpLoc })}</span>
                    <Badge tone={inv.status === 'ISSUED' ? 'green' : 'slate'}>{t(`invoices.statuses.${inv.status}`)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-faint">{t('common.noResults')}</p>}
        </Card>
      </div>

      {/* Contracts */}
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">{t('contracts.title')}</h2>
        {contracts.isLoading ? <Skeleton className="h-20 w-full" /> : contracts.data && contracts.data.length > 0 ? (
          <div className="space-y-2">
            {contracts.data.map((c) => (
              <div key={c.id} className="border border-line rounded-md p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{new Date(c.startsOn).toLocaleDateString()}</span>
                  {c.isActive ? <Badge tone="green">{t('contracts.activeBadge')}</Badge> : <Badge tone="slate">{t('contracts.inactiveBadge')}</Badge>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-body">
                  <span>{t('contracts.storageEgp')}: {formatEgp(c.storagePerSkuPerDayPiastres, { locale: egpLoc })}</span>
                  <span>{t('contracts.pickPackEgp')}: {formatEgp(c.pickAndPackPiastres, { locale: egpLoc })}</span>
                  <span>{t('contracts.codCommissionPct')}: {(c.codCommissionBps / 100).toFixed(2)}%</span>
                  <span>{t('contracts.returnFeeEgp')}: {formatEgp(c.returnFeePiastres, { locale: egpLoc })}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-faint">{t('contracts.none')}</p>}
      </Card>
    </div>
  );
}
