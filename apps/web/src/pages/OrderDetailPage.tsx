import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  GOVERNORATES,
  ORDER_STATE_TRANSITIONS,
  formatEgp,
  type OrderState,
} from '@3pl/shared';

import { getOrder, transitionOrder } from '../api/orders';
import { useAuthStore } from '../stores/auth.store';
import { Button, Card, Spinner, Badge, Alert, TextField } from '../components/ui';
import { OrderStateBadge } from '../components/orders/OrderStateBadge';
import { currentLocale } from '../i18n';

export default function OrderDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const canTransition = useAuthStore((s) => s.hasPermission('orders.transition'));

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const order = useQuery({ queryKey: ['order', id], queryFn: () => getOrder(id!), enabled: !!id });

  const transition = useMutation({
    mutationFn: (toState: OrderState) => transitionOrder(id!, toState, reason || undefined),
    onSuccess: () => {
      setReason('');
      setError(null);
      void qc.invalidateQueries({ queryKey: ['order', id] });
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => {
      const ax = e as AxiosError<{ message?: string }>;
      setError(ax.response?.data?.message ?? t('orders.transitionError'));
    },
  });

  if (order.isLoading) return <Spinner />;
  if (order.isError || !order.data) return <Alert>{t('common.loadError')}</Alert>;

  const o = order.data;
  const gov = GOVERNORATES.find((g) => g.code === o.governorate);
  const nextStates = ORDER_STATE_TRANSITIONS[o.state] ?? [];
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(egpLoc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(iso));
  const itemsTotal = o.items.reduce((sum, i) => sum + i.quantity * i.unitPricePiastres, 0);

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link to="/orders" className="text-sm text-brand-600 hover:underline">← {t('orders.title')}</Link>
          <h1 className="text-2xl font-bold mt-1" dir="ltr">{o.reference}</h1>
        </div>
        <div className="flex items-center gap-2">
          <OrderStateBadge state={o.state} />
          <Badge tone="slate">{t(`intake.${o.intakeSource}`)}</Badge>
        </div>
      </div>

      {o.flaggedReason && <Alert tone="amber">⚑ {t('orders.flagged')}: {o.flaggedReason}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">{t('orders.customer')}</h2>
          <dl className="text-sm space-y-1">
            <Row label={t('orders.customerName')} value={o.customerName} />
            <Row label={t('orders.phone')} value={o.customerPhone} ltr />
            {o.customerPhoneAlt && <Row label={t('orders.phoneAlt')} value={o.customerPhoneAlt} ltr />}
            <Row label={t('clients.governorate')} value={(locale === 'ar' ? gov?.nameAr : gov?.nameEn) ?? ''} />
            <Row
              label={t('orders.address')}
              value={[o.addressApartment, o.addressFloor, o.addressBuilding, o.addressStreet, o.addressDistrict].filter(Boolean).join(' / ') || '—'}
            />
            {o.notes && <Row label={t('orders.notes')} value={o.notes} />}
          </dl>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">{t('orders.fulfilment')}</h2>
          <dl className="text-sm space-y-1">
            <Row label={t('orders.client')} value={o.client.legalName} />
            <Row label={t('orders.warehouse')} value={`${o.warehouse.name} (${o.warehouse.code})`} />
            <Row label={t('orders.payment')} value={t(`orders.payments.${o.paymentMethod}`)} />
            {o.paymentMethod === 'COD' && o.codAmountPiastres != null && (
              <Row label={t('orders.codAmount')} value={formatEgp(o.codAmountPiastres, { locale: egpLoc })} />
            )}
            <Row label={t('orders.createdAt')} value={fmtDate(o.createdAt)} />
          </dl>
        </Card>
      </div>

      {/* Items */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('orders.items')}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 border-b border-slate-200">
              <th className="text-start font-medium px-2 py-2">SKU</th>
              <th className="text-start font-medium px-2 py-2">{t('orders.itemName')}</th>
              <th className="text-start font-medium px-2 py-2">{t('orders.qty')}</th>
              <th className="text-start font-medium px-2 py-2">{t('orders.unitPrice')}</th>
              <th className="text-end font-medium px-2 py-2">{t('orders.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="px-2 py-2" dir="ltr">{i.sku.code}</td>
                <td className="px-2 py-2">{locale === 'ar' ? i.sku.nameAr : (i.sku.nameEn ?? i.sku.nameAr)}</td>
                <td className="px-2 py-2">{i.quantity}</td>
                <td className="px-2 py-2">{formatEgp(i.unitPricePiastres, { locale: egpLoc })}</td>
                <td className="px-2 py-2 text-end">{formatEgp(i.quantity * i.unitPricePiastres, { locale: egpLoc })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={4} className="px-2 py-2 text-end">{t('orders.itemsTotal')}</td>
              <td className="px-2 py-2 text-end">{formatEgp(itemsTotal, { locale: egpLoc })}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {/* Transition controls */}
      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">{t('orders.advance')}</h2>
        {nextStates.length === 0 ? (
          <p className="text-sm text-slate-400">{t('orders.terminal')}</p>
        ) : !canTransition ? (
          <p className="text-sm text-slate-400">{t('orders.noTransitionPermission')}</p>
        ) : (
          <>
            <TextField label={t('orders.reasonOptional')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {nextStates.map((s) => (
                <Button key={s} onClick={() => transition.mutate(s)} disabled={transition.isPending}>
                  → {t(`orders.states.${s}`)}
                </Button>
              ))}
            </div>
            {error && <Alert>{error}</Alert>}
          </>
        )}
      </Card>

      {/* History + COD ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('orders.history')}</h2>
          <ol className="space-y-2 text-sm">
            {o.transitions.map((tr) => (
              <li key={tr.id} className="flex items-center gap-2">
                <span className="text-slate-400 text-xs whitespace-nowrap">{fmtDate(tr.createdAt)}</span>
                <OrderStateBadge state={tr.toState} />
                {tr.reason && <span className="text-slate-500 text-xs">— {tr.reason}</span>}
              </li>
            ))}
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('cod.ledger')}</h2>
          {o.codLedger.length === 0 ? (
            <p className="text-sm text-slate-400">{t('cod.noEntries')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {o.codLedger.map((e) => (
                <li key={e.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Badge tone={e.type === 'COLLECTED' ? 'green' : e.type === 'REMITTED' ? 'blue' : 'amber'}>
                      {t(`cod.types.${e.type}`)}
                    </Badge>
                    <span className="text-slate-400 text-xs">{fmtDate(e.createdAt)}</span>
                  </span>
                  <span>{formatEgp(e.amountPiastres, { locale: egpLoc })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-end" dir={ltr ? 'ltr' : undefined}>{value}</dd>
    </div>
  );
}
