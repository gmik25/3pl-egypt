import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  adjustStock,
  changeStockStatus,
  listLocations,
  listSkus,
  listWarehouses,
  lowStock,
  stockBySku,
} from '../../api/wms';
import type { Sku, StockStatus } from '../../types';
import { Boxes } from 'lucide-react';
import { Button, Card, Select, TextField, Spinner, TableSkeleton, EmptyState, Badge, Alert } from '../../components/ui';
import { currentLocale } from '../../i18n';

const STATUS_TONE: Record<StockStatus, 'green' | 'amber' | 'red'> = {
  AVAILABLE: 'green',
  QUARANTINE: 'amber',
  DAMAGED: 'red',
};

export default function InventoryPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();

  const [skuSearch, setSkuSearch] = useState('');
  const [sku, setSku] = useState<Sku | null>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [delta, setDelta] = useState('0');
  const [adjStatus, setAdjStatus] = useState<StockStatus>('AVAILABLE');
  const [error, setError] = useState<string | null>(null);

  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const skuResults = useQuery({
    queryKey: ['sku-search', skuSearch],
    queryFn: () => listSkus({ search: skuSearch, pageSize: 8 }),
    enabled: skuSearch.length >= 2,
  });
  const locations = useQuery({
    queryKey: ['locations', warehouseId],
    queryFn: () => listLocations(warehouseId),
    enabled: !!warehouseId,
  });
  const stock = useQuery({
    queryKey: ['stock', sku?.id],
    queryFn: () => stockBySku(sku!.id),
    enabled: !!sku,
  });
  const low = useQuery({ queryKey: ['low-stock'], queryFn: () => lowStock() });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['stock', sku?.id] });
    void qc.invalidateQueries({ queryKey: ['low-stock'] });
  };

  const adjust = useMutation({
    mutationFn: () => adjustStock({ skuId: sku!.id, locationId, deltaQty: Number(delta), status: adjStatus }),
    onSuccess: () => { setDelta('0'); setError(null); refresh(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? t('inventory.adjustError')),
  });
  const quarantine = useMutation({
    mutationFn: (v: { locationId: string; qty: number; from: StockStatus; to: StockStatus }) =>
      changeStockStatus({ skuId: sku!.id, locationId: v.locationId, quantity: v.qty, fromStatus: v.from, toStatus: v.to }),
    onSuccess: refresh,
  });

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">{t('inventory.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card className="p-4">
            <TextField label={t('inventory.findSku')} value={skuSearch} onChange={(e) => setSkuSearch(e.target.value)} placeholder={t('catalog.searchPlaceholder')} />
            {skuResults.data && skuSearch.length >= 2 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {skuResults.data.items.map((s) => (
                  <button key={s.id} onClick={() => { setSku(s); setSkuSearch(''); }} className="text-xs border border-line rounded px-2 py-1 hover:bg-surface-muted">
                    <span dir="ltr">{s.code}</span> — {locale === 'ar' ? s.nameAr : (s.nameEn ?? s.nameAr)}
                  </button>
                ))}
              </div>
            )}
          </Card>

          {sku && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-3"><span dir="ltr">{sku.code}</span> — {locale === 'ar' ? sku.nameAr : (sku.nameEn ?? sku.nameAr)}</h2>
              {stock.isLoading ? <TableSkeleton cols={5} /> : stock.data && stock.data.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted border-b border-line">
                      <th className="text-start font-medium px-2 py-2">{t('inventory.location')}</th>
                      <th className="text-start font-medium px-2 py-2">{t('inventory.status')}</th>
                      <th className="text-start font-medium px-2 py-2">{t('inventory.lot')}</th>
                      <th className="text-end font-medium px-2 py-2">{t('inventory.qty')}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.data.map((l) => (
                      <tr key={l.id} className="border-b border-line-soft">
                        <td className="px-2 py-2" dir="ltr">{l.location?.code}</td>
                        <td className="px-2 py-2"><Badge tone={STATUS_TONE[l.status]}>{t(`inventory.statuses.${l.status}`)}</Badge></td>
                        <td className="px-2 py-2 text-muted text-xs">
                          {l.lot ? <>{l.lot.lotNumber}{l.lot.expiryDate && <> · {new Date(l.lot.expiryDate).toLocaleDateString()}</>}</> : '—'}
                        </td>
                        <td className="px-2 py-2 text-end font-medium">{l.quantity}</td>
                        <td className="px-2 py-2 text-end">
                          {l.status === 'AVAILABLE' && (
                            <Button variant="ghost" onClick={() => quarantine.mutate({ locationId: l.locationId, qty: l.quantity, from: 'AVAILABLE', to: 'QUARANTINE' })}>{t('inventory.quarantine')}</Button>
                          )}
                          {l.status === 'QUARANTINE' && (
                            <Button variant="ghost" onClick={() => quarantine.mutate({ locationId: l.locationId, qty: l.quantity, from: 'QUARANTINE', to: 'AVAILABLE' })}>{t('inventory.release')}</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <EmptyState icon={Boxes} title={t('inventory.noStock')} />}

              {/* Adjust */}
              <div className="border-t border-line-soft mt-4 pt-4">
                <h3 className="text-sm font-medium mb-2">{t('inventory.adjust')}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <Select label={t('orders.warehouse')} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setLocationId(''); }}>
                    <option value="">—</option>
                    {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
                  </Select>
                  <Select label={t('inventory.location')} value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!warehouseId}>
                    <option value="">—</option>
                    {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                  </Select>
                  <TextField label={t('inventory.delta')} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} />
                  <Select label={t('inventory.status')} value={adjStatus} onChange={(e) => setAdjStatus(e.target.value as StockStatus)}>
                    {(['AVAILABLE', 'QUARANTINE', 'DAMAGED'] as StockStatus[]).map((s) => <option key={s} value={s}>{t(`inventory.statuses.${s}`)}</option>)}
                  </Select>
                </div>
                {error && <Alert>{error}</Alert>}
                <Button className="mt-3" disabled={!locationId || Number(delta) === 0 || adjust.isPending} onClick={() => adjust.mutate()}>
                  {t('inventory.applyAdjust')}
                </Button>
              </div>
            </Card>
          )}
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('inventory.lowStock')}</h2>
          {low.isLoading ? <Spinner /> : low.data && low.data.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {low.data.map((r) => (
                <li key={r.skuId} className="flex items-center justify-between">
                  <span dir="ltr">{r.code}</span>
                  <Badge tone="red">{r.available} / {r.reorderPointQty}</Badge>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-faint">{t('inventory.noLowStock')}</p>}
        </Card>
      </div>
    </div>
  );
}
