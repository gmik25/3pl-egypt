import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { GOVERNORATES, ORDER_STATES, formatEgp, type GovernorateCode, type OrderState } from '@3pl/shared';

import { listOrders } from '../api/orders';
import { Button, Card, Select, TextField, Spinner, Badge } from '../components/ui';
import { OrderStateBadge } from '../components/orders/OrderStateBadge';
import { currentLocale } from '../i18n';

const PAGE_SIZE = 25;

export default function OrdersPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const [search, setSearch] = useState('');
  const [state, setState] = useState<OrderState | ''>('');
  const [governorate, setGovernorate] = useState<GovernorateCode | ''>('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['orders', { search, state, governorate, flaggedOnly, page }],
    queryFn: () =>
      listOrders({
        search: search || undefined,
        state: state || undefined,
        governorate: governorate || undefined,
        flaggedOnly: flaggedOnly || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const reset = () => setPage(1);

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('orders.title')}</h1>
        <div className="flex gap-2">
          <Link to="/orders/import">
            <Button variant="secondary">{t('orders.import')}</Button>
          </Link>
          <Link to="/orders/new">
            <Button>{t('orders.create')}</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <TextField
            label={t('orders.search')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset(); }}
            placeholder={t('orders.searchPlaceholder')}
          />
          <Select label={t('orders.state')} value={state} onChange={(e) => { setState(e.target.value as OrderState | ''); reset(); }}>
            <option value="">{t('common.all')}</option>
            {ORDER_STATES.map((s) => (
              <option key={s} value={s}>{t(`orders.states.${s}`)}</option>
            ))}
          </Select>
          <Select label={t('clients.governorate')} value={governorate} onChange={(e) => { setGovernorate(e.target.value as GovernorateCode | ''); reset(); }}>
            <option value="">{t('common.all')}</option>
            {GOVERNORATES.map((g) => (
              <option key={g.code} value={g.code}>{locale === 'ar' ? g.nameAr : g.nameEn}</option>
            ))}
          </Select>
          <label className="flex items-end gap-2 text-sm pb-2">
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => { setFlaggedOnly(e.target.checked); reset(); }} />
            {t('orders.flaggedOnly')}
          </label>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="p-6 text-red-600 text-sm">{t('common.loadError')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-start font-medium px-4 py-3">{t('orders.reference')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.customer')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('clients.governorate')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.payment')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.state')}</th>
                  <th className="text-start font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((o) => {
                  const gov = GOVERNORATES.find((g) => g.code === o.governorate);
                  return (
                    <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link to={`/orders/${o.id}`} className="text-brand-600 hover:underline font-medium" dir="ltr">
                          {o.reference}
                        </Link>
                        <span className="block text-xs text-slate-400">{o.client.legalName}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {o.customerName}
                        <span className="block text-xs text-slate-400" dir="ltr">{o.customerPhone}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{locale === 'ar' ? gov?.nameAr : gov?.nameEn}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {o.paymentMethod === 'COD' && o.codAmountPiastres != null
                          ? `${t('orders.cod')} · ${formatEgp(o.codAmountPiastres, { locale: egpLoc })}`
                          : t(`orders.payments.${o.paymentMethod}`)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <OrderStateBadge state={o.state} />
                          {o.flaggedReason && <Badge tone="red">⚑</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{t(`intake.${o.intakeSource}`)}</td>
                    </tr>
                  );
                })}
                {data?.items.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('common.noResults')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('common.previous')}</Button>
          <span>{page} / {totalPages}</span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </div>
  );
}
