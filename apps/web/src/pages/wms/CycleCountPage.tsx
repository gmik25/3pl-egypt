import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  listCycleCounts,
  listLocations,
  listSkus,
  listWarehouses,
  openCycleCount,
  recordCycleCount,
  reconcileCycleCount,
} from '../../api/wms';
import type { CycleCountStatus } from '../../types';
import { Button, Card, Select, TextField, Spinner, Badge } from '../../components/ui';

const TONE: Record<CycleCountStatus, 'amber' | 'blue' | 'green'> = { OPEN: 'amber', COUNTED: 'blue', RECONCILED: 'green' };

export default function CycleCountPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [warehouseId, setWarehouseId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [skuId, setSkuId] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});

  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const locations = useQuery({ queryKey: ['locations', warehouseId], queryFn: () => listLocations(warehouseId), enabled: !!warehouseId });
  const skuResults = useQuery({ queryKey: ['sku-search', skuSearch], queryFn: () => listSkus({ search: skuSearch, pageSize: 8 }), enabled: skuSearch.length >= 2 });
  const list = useQuery({ queryKey: ['cycle-counts'], queryFn: () => listCycleCounts() });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['cycle-counts'] });

  const open = useMutation({ mutationFn: () => openCycleCount({ warehouseId, locationId, skuId }), onSuccess: () => { setSkuId(''); setSkuSearch(''); refresh(); } });
  const record = useMutation({ mutationFn: (v: { id: string; qty: number }) => recordCycleCount(v.id, v.qty), onSuccess: refresh });
  const reconcile = useMutation({ mutationFn: (id: string) => reconcileCycleCount(id), onSuccess: refresh });

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">{t('counting.title')}</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('counting.openNew')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Select label={t('orders.warehouse')} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setLocationId(''); }}>
            <option value="">—</option>
            {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
          </Select>
          <Select label={t('inventory.location')} value={locationId} onChange={(e) => setLocationId(e.target.value)} disabled={!warehouseId}>
            <option value="">—</option>
            {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
          </Select>
          <TextField label={t('inventory.findSku')} value={skuId ? skuSearch : skuSearch} onChange={(e) => { setSkuSearch(e.target.value); setSkuId(''); }} />
        </div>
        {skuSearch.length >= 2 && !skuId && (
          <div className="mt-2 flex flex-wrap gap-2">
            {skuResults.data?.items.map((s) => (
              <button key={s.id} onClick={() => { setSkuId(s.id); setSkuSearch(s.code); }} className="text-xs border border-slate-300 rounded px-2 py-1 hover:bg-slate-50" dir="ltr">{s.code}</button>
            ))}
          </div>
        )}
        <Button className="mt-3" disabled={!warehouseId || !locationId || !skuId || open.isPending} onClick={() => open.mutate()}>{t('counting.open')}</Button>
      </Card>

      <Card>
        {list.isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-start font-medium px-4 py-3">SKU</th>
                  <th className="text-end font-medium px-4 py-3">{t('counting.expected')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('counting.counted')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('counting.variance')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.state')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-4 py-3" dir="ltr">{c.sku?.code}</td>
                    <td className="px-4 py-3 text-end">{c.expectedQty}</td>
                    <td className="px-4 py-3 text-end">
                      {c.status === 'OPEN' ? (
                        <input
                          className="w-20 rounded border border-slate-300 px-2 py-1 text-end"
                          inputMode="numeric"
                          value={counts[c.id] ?? ''}
                          onChange={(e) => setCounts((m) => ({ ...m, [c.id]: e.target.value }))}
                          placeholder="0"
                        />
                      ) : c.countedQty}
                    </td>
                    <td className={`px-4 py-3 text-end ${c.varianceQty ? (c.varianceQty < 0 ? 'text-red-600' : 'text-green-600') : ''}`}>
                      {c.varianceQty ?? '—'}
                    </td>
                    <td className="px-4 py-3"><Badge tone={TONE[c.status]}>{t(`counting.statuses.${c.status}`)}</Badge></td>
                    <td className="px-4 py-3 text-end">
                      {c.status === 'OPEN' && (
                        <Button variant="secondary" disabled={!counts[c.id] || record.isPending} onClick={() => record.mutate({ id: c.id, qty: Number(counts[c.id]) })}>{t('counting.record')}</Button>
                      )}
                      {c.status === 'COUNTED' && (
                        <Button disabled={reconcile.isPending} onClick={() => reconcile.mutate(c.id)}>{t('counting.reconcile')}</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {list.data?.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('common.noResults')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
