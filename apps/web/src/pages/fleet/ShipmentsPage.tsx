import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';

import { listOrders } from '../../api/orders';
import { createShipment, listShipments, suggestCarriers } from '../../api/fleet';
import type { OrderListItem, ShipmentStatus } from '../../types';
import { Button, Card, Select, Spinner, Badge } from '../../components/ui';
import { ShipmentStatusBadge } from '../../components/fleet/ShipmentStatusBadge';
import { currentLocale } from '../../i18n';

const STATUSES: ShipmentStatus[] = ['PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'];

export default function ShipmentsPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [status, setStatus] = useState<ShipmentStatus | ''>('');

  const packed = useQuery({ queryKey: ['orders', 'packed'], queryFn: () => listOrders({ state: 'PACKED', pageSize: 50 }) });
  const shipments = useQuery({
    queryKey: ['shipments', status],
    queryFn: () => listShipments({ status: status || undefined }),
    placeholderData: keepPreviousData,
  });

  const govName = (code: GovernorateCode) => {
    const g = GOVERNORATES.find((x) => x.code === code);
    return locale === 'ar' ? g?.nameAr : g?.nameEn;
  };

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">{t('fleet.title')}</h1>

      {/* Ready to dispatch */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('fleet.readyToDispatch')}</h2>
        {packed.isLoading ? <Spinner /> : packed.data && packed.data.items.length > 0 ? (
          <div className="space-y-2">
            {packed.data.items.map((o) => <DispatchRow key={o.id} order={o} govName={govName} />)}
          </div>
        ) : <p className="text-sm text-faint">{t('fleet.nothingToDispatch')}</p>}
      </Card>

      {/* Shipments */}
      <Card className="p-4">
        <div className="w-64">
          <Select label={t('orders.state')} value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus | '')}>
            <option value="">{t('common.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`fleet.statuses.${s}`)}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        {shipments.isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('fleet.reference')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('fleet.carrier')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.customer')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('fleet.attempts')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.state')}</th>
                </tr>
              </thead>
              <tbody>
                {shipments.data?.map((s) => (
                  <tr key={s.id} className="border-b border-line-soft hover:bg-surface-muted">
                    <td className="px-4 py-3">
                      <Link to={`/shipments/${s.id}`} className="text-accent hover:underline font-medium" dir="ltr">{s.reference}</Link>
                      {s.trackingNumber && <span className="block text-xs text-faint" dir="ltr">{s.trackingNumber}</span>}
                    </td>
                    <td className="px-4 py-3 text-body">{s.carrierType === 'COURIER' ? (s.courierAccount?.name ?? '—') : (s.driver?.fullName ?? t('fleet.inHouse'))}</td>
                    <td className="px-4 py-3">{s.order?.customerName}<span className="block text-xs text-faint">{govName(s.governorate)}</span></td>
                    <td className="px-4 py-3 text-body">{s.attemptCount}</td>
                    <td className="px-4 py-3"><ShipmentStatusBadge status={s.status} /></td>
                  </tr>
                ))}
                {shipments.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-faint">{t('common.noResults')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function DispatchRow({ order, govName }: { order: OrderListItem; govName: (c: GovernorateCode) => string | undefined }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const suggestion = useQuery({ queryKey: ['coverage', order.governorate], queryFn: () => suggestCarriers(order.governorate), enabled: open });

  const dispatch = useMutation({
    mutationFn: (input: { carrierType: 'COURIER' | 'IN_HOUSE'; courierId?: string; driverId?: string }) =>
      createShipment({ orderId: order.id, ...input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders', 'packed'] });
      void qc.invalidateQueries({ queryKey: ['shipments'] });
    },
  });

  return (
    <div className="border border-line rounded-md p-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="font-medium" dir="ltr">{order.reference}</span>
          <span className="text-faint ms-2">{order.customerName} · {govName(order.governorate)}</span>
        </div>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)}>{open ? t('common.cancel') : t('fleet.dispatch')}</Button>
      </div>
      {open && (
        <div className="mt-3 border-t border-line-soft pt-3">
          {suggestion.isLoading ? <Spinner /> : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted mb-1">{t('fleet.couriersLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestion.data?.couriers.map((c) => (
                    <Button key={c.courierId} variant="secondary" disabled={dispatch.isPending} onClick={() => dispatch.mutate({ carrierType: 'COURIER', courierId: c.courierId })}>
                      {c.name} <span className="text-faint ms-1">{c.etaDays}{t('fleet.daysShort')}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted mb-1">{t('fleet.inHouseLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestion.data?.inHouseDrivers.length ? suggestion.data.inHouseDrivers.map((d) => (
                    <Button key={d.driverId} disabled={dispatch.isPending} onClick={() => dispatch.mutate({ carrierType: 'IN_HOUSE', driverId: d.driverId })}>{d.name}</Button>
                  )) : <Badge tone="slate">{t('fleet.noDriversInZone')}</Badge>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
