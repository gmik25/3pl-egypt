import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listClients } from '../../api/clients';
import {
  createPurchaseOrder,
  getPurchaseOrder,
  listLocations,
  listPurchaseOrders,
  listSkus,
  listWarehouses,
  receivePoLine,
  type CreatePoInput,
} from '../../api/wms';
import type { InspectionResult, PurchaseOrderStatus } from '../../types';
import { Button, Card, Select, TextField, Spinner, Badge, Alert } from '../../components/ui';

const PO_TONE: Record<PurchaseOrderStatus, 'slate' | 'blue' | 'amber' | 'green' | 'red'> = {
  DRAFT: 'slate', CONFIRMED: 'blue', PARTIALLY_RECEIVED: 'amber', RECEIVED: 'green', CANCELLED: 'red',
};

export default function ReceivingPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const pos = useQuery({ queryKey: ['purchase-orders'], queryFn: () => listPurchaseOrders() });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('receiving.title')}</h1>
        <Button onClick={() => setShowNew((s) => !s)}>{showNew ? t('common.cancel') : t('receiving.createPo')}</Button>
      </div>

      {showNew && <NewPoForm onDone={() => { setShowNew(false); void qc.invalidateQueries({ queryKey: ['purchase-orders'] }); }} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-3">
          {pos.isLoading ? <Spinner /> : (
            <ul className="space-y-1">
              {pos.data?.map((p) => (
                <li key={p.id}>
                  <button onClick={() => setSelected(p.id)} className={`w-full text-start px-3 py-2 rounded-md text-sm transition ${selected === p.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-100'}`}>
                    <span className="font-medium" dir="ltr">{p.reference}</span>
                    <span className="block text-xs text-slate-400">{p.client?.legalName}</span>
                    <Badge tone={PO_TONE[p.status]}>{t(`receiving.statuses.${p.status}`)}</Badge>
                  </button>
                </li>
              ))}
              {pos.data?.length === 0 && <li className="text-sm text-slate-400 px-3 py-2">{t('common.noResults')}</li>}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-2">
          {selected ? <PoDetail poId={selected} /> : <Card className="p-8 text-center text-slate-400 text-sm">{t('receiving.selectPrompt')}</Card>}
        </div>
      </div>
    </div>
  );
}

function NewPoForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [lines, setLines] = useState<{ skuId: string; quantityOrdered: string }[]>([{ skuId: '', quantityOrdered: '1' }]);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const skus = useQuery({ queryKey: ['skus', clientId], queryFn: () => listSkus({ clientId, pageSize: 100 }), enabled: !!clientId });

  const create = useMutation({ mutationFn: (input: CreatePoInput) => createPurchaseOrder(input), onSuccess: onDone });

  const submit = () => {
    create.mutate({
      clientId,
      warehouseId,
      supplierName: supplierName || undefined,
      lines: lines.filter((l) => l.skuId).map((l) => ({ skuId: l.skuId, quantityOrdered: Number(l.quantityOrdered) || 1 })),
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select label={t('orders.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">{t('orders.selectClient')}</option>
          {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
        </Select>
        <Select label={t('orders.warehouse')} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">—</option>
          {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code}</option>)}
        </Select>
        <TextField label={t('receiving.supplier')} value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-end">
            <Select label="SKU" value={l.skuId} onChange={(e) => setLines((rs) => rs.map((r, j) => j === i ? { ...r, skuId: e.target.value } : r))}>
              <option value="">{clientId ? '—' : t('orders.selectClient')}</option>
              {skus.data?.items.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.nameAr}</option>)}
            </Select>
            <TextField label={t('receiving.qtyOrdered')} inputMode="numeric" value={l.quantityOrdered} onChange={(e) => setLines((rs) => rs.map((r, j) => j === i ? { ...r, quantityOrdered: e.target.value } : r))} />
            {lines.length > 1 && <Button type="button" variant="ghost" onClick={() => setLines((rs) => rs.filter((_, j) => j !== i))}>{t('common.remove')}</Button>}
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setLines((rs) => [...rs, { skuId: '', quantityOrdered: '1' }])}>{t('orders.addItem')}</Button>
      </div>
      <Button disabled={!clientId || !warehouseId || create.isPending} onClick={submit}>{create.isPending ? t('common.pleaseWait') : t('receiving.createPo')}</Button>
    </Card>
  );
}

function PoDetail({ poId }: { poId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const po = useQuery({ queryKey: ['purchase-order', poId], queryFn: () => getPurchaseOrder(poId) });
  const locations = useQuery({ queryKey: ['locations', po.data?.warehouseId], queryFn: () => listLocations(po.data!.warehouseId), enabled: !!po.data?.warehouseId });

  const [receivingLine, setReceivingLine] = useState<string | null>(null);
  const [locationId, setLocationId] = useState('');
  const [qty, setQty] = useState('');
  const [inspection, setInspection] = useState<InspectionResult>('PASS');
  const [error, setError] = useState<string | null>(null);

  const receive = useMutation({
    mutationFn: (poLineId: string) => receivePoLine({ poLineId, locationId, quantity: Number(qty), inspection }),
    onSuccess: () => {
      setReceivingLine(null); setQty(''); setError(null);
      void qc.invalidateQueries({ queryKey: ['purchase-order', poId] });
      void qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (e: any) => setError(e?.response?.data?.message ?? t('receiving.receiveError')),
  });

  if (po.isLoading || !po.data) return <Spinner />;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" dir="ltr">{po.data.reference}</h2>
        <Badge tone={PO_TONE[po.data.status]}>{t(`receiving.statuses.${po.data.status}`)}</Badge>
      </div>
      <p className="text-sm text-slate-500">{po.data.client?.legalName} · {po.data.warehouse?.name}</p>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 border-b border-slate-200">
            <th className="text-start font-medium px-2 py-2">SKU</th>
            <th className="text-end font-medium px-2 py-2">{t('receiving.ordered')}</th>
            <th className="text-end font-medium px-2 py-2">{t('receiving.received')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {po.data.lines?.map((l) => {
            const remaining = l.quantityOrdered - l.quantityReceived;
            return (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="px-2 py-2" dir="ltr">{l.sku?.code}<span className="block text-xs text-slate-400" dir="auto">{l.sku?.nameAr}</span></td>
                <td className="px-2 py-2 text-end">{l.quantityOrdered}</td>
                <td className="px-2 py-2 text-end">{l.quantityReceived}</td>
                <td className="px-2 py-2 text-end">
                  {remaining > 0 ? (
                    receivingLine === l.id ? (
                      <div className="space-y-2 text-start bg-slate-50 p-2 rounded">
                        <Select label={t('inventory.location')} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                          <option value="">—</option>
                          {locations.data?.map((loc) => <option key={loc.id} value={loc.id}>{loc.code}</option>)}
                        </Select>
                        <TextField label={`${t('receiving.qty')} (≤ ${remaining})`} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} />
                        <Select label={t('receiving.inspection')} value={inspection} onChange={(e) => setInspection(e.target.value as InspectionResult)}>
                          {(['PASS', 'DAMAGED', 'REJECTED'] as InspectionResult[]).map((x) => <option key={x} value={x}>{t(`receiving.inspections.${x}`)}</option>)}
                        </Select>
                        {error && <Alert>{error}</Alert>}
                        <div className="flex gap-2">
                          <Button disabled={!locationId || !qty || receive.isPending} onClick={() => receive.mutate(l.id)}>{t('receiving.confirm')}</Button>
                          <Button variant="ghost" onClick={() => setReceivingLine(null)}>{t('common.cancel')}</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="secondary" onClick={() => { setReceivingLine(l.id); setLocationId(''); setQty(String(remaining)); setError(null); }}>{t('receiving.receive')}</Button>
                    )
                  ) : <Badge tone="green">✓</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
