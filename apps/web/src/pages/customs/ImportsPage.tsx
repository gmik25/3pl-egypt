import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { egpToPiastres, formatEgp } from '@3pl/shared';

import { listClients } from '../../api/clients';
import { listSkus, listWarehouses, listLocations } from '../../api/wms';
import {
  clearImport,
  createImport,
  declareImport,
  getImport,
  getLandedCost,
  inspectImport,
  listImports,
  releaseImport,
  type CreateImportInput,
} from '../../api/customs';
import type { ImportStatus } from '../../types';
import { Button, Card, Select, TextField, Spinner, Badge, Alert } from '../../components/ui';
import { currentLocale } from '../../i18n';

const TONE: Record<ImportStatus, 'slate' | 'blue' | 'amber' | 'green' | 'red'> = {
  DRAFT: 'slate', DECLARED: 'blue', UNDER_INSPECTION: 'amber', CLEARED: 'blue', RELEASED: 'green', CANCELLED: 'red',
};

export default function ImportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const imports = useQuery({ queryKey: ['imports'], queryFn: () => listImports() });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('customs.importsTitle')}</h1>
        <Button onClick={() => setShowNew((s) => !s)}>{showNew ? t('common.cancel') : t('customs.newImport')}</Button>
      </div>

      {showNew && <NewImportForm onDone={(id) => { setShowNew(false); setSelected(id); void qc.invalidateQueries({ queryKey: ['imports'] }); }} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-3">
          {imports.isLoading ? <Spinner /> : (
            <ul className="space-y-1">
              {imports.data?.map((i) => (
                <li key={i.id}>
                  <button onClick={() => setSelected(i.id)} className={`w-full text-start px-3 py-2 rounded-md text-sm transition ${selected === i.id ? 'bg-accent/10 text-accent' : 'hover:bg-surface-muted'}`}>
                    <span className="font-medium" dir="ltr">{i.reference}</span>
                    <span className="block text-xs text-faint">{i.client?.legalName}</span>
                    <span className="flex items-center gap-1 mt-1"><Badge tone={TONE[i.status]}>{t(`customs.statuses.${i.status}`)}</Badge>{i.bonded && <Badge tone="amber">{t('customs.bonded')}</Badge>}</span>
                  </button>
                </li>
              ))}
              {imports.data?.length === 0 && <li className="text-sm text-faint px-3 py-2">{t('common.noResults')}</li>}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-2">
          {selected ? <ImportDetail importId={selected} /> : <Card className="p-8 text-center text-faint text-sm">{t('customs.selectPrompt')}</Card>}
        </div>
      </div>
    </div>
  );
}

function NewImportForm({ onDone }: { onDone: (id: string) => void }) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [origin, setOrigin] = useState('');
  const [supplier, setSupplier] = useState('');
  const [freight, setFreight] = useState('0.00');
  const [insurance, setInsurance] = useState('0.00');
  const [bonded, setBonded] = useState(false);
  const [lines, setLines] = useState<{ skuId: string; quantity: string; unitCostEgp: string }[]>([{ skuId: '', quantity: '1', unitCostEgp: '0.00' }]);
  const [error, setError] = useState<string | null>(null);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const skus = useQuery({ queryKey: ['skus', clientId], queryFn: () => listSkus({ clientId, pageSize: 100 }), enabled: !!clientId });

  const create = useMutation({
    mutationFn: (input: CreateImportInput) => createImport(input),
    onSuccess: (s) => onDone(s.id),
    onError: (e: any) => setError(e?.response?.data?.message ?? t('customs.createError')),
  });

  const submit = () => {
    setError(null);
    create.mutate({
      clientId,
      warehouseId: warehouseId || undefined,
      originCountry: origin || undefined,
      supplierName: supplier || undefined,
      freightCostPiastres: egpToPiastres(freight),
      insuranceCostPiastres: egpToPiastres(insurance),
      bonded,
      lines: lines.filter((l) => l.skuId).map((l) => ({ skuId: l.skuId, quantity: Number(l.quantity) || 1, unitCostPiastres: egpToPiastres(l.unitCostEgp) })),
    });
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select label={t('orders.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">{t('orders.selectClient')}</option>
          {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
        </Select>
        <Select label={t('orders.warehouse')} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">—</option>
          {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.code}{w.isBonded ? ' ⓑ' : ''}</option>)}
        </Select>
        <TextField label={t('customs.origin')} value={origin} onChange={(e) => setOrigin(e.target.value)} />
        <TextField label={t('customs.supplier')} value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        <TextField label={t('customs.freightEgp')} inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} />
        <TextField label={t('customs.insuranceEgp')} inputMode="decimal" value={insurance} onChange={(e) => setInsurance(e.target.value)} />
        <label className="flex items-end gap-2 text-sm pb-2"><input type="checkbox" checked={bonded} onChange={(e) => setBonded(e.target.checked)} />{t('customs.bondedZone')}</label>
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-end">
            <Select label="SKU" value={l.skuId} onChange={(e) => setLines((rs) => rs.map((r, j) => j === i ? { ...r, skuId: e.target.value } : r))}>
              <option value="">{clientId ? '—' : t('orders.selectClient')}</option>
              {skus.data?.items.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.nameAr}{s.hsCode ? ` [${s.hsCode}]` : ''}</option>)}
            </Select>
            <TextField label={t('orders.qty')} inputMode="numeric" value={l.quantity} onChange={(e) => setLines((rs) => rs.map((r, j) => j === i ? { ...r, quantity: e.target.value } : r))} />
            <TextField label={t('customs.unitCostEgp')} inputMode="decimal" value={l.unitCostEgp} onChange={(e) => setLines((rs) => rs.map((r, j) => j === i ? { ...r, unitCostEgp: e.target.value } : r))} />
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setLines((rs) => [...rs, { skuId: '', quantity: '1', unitCostEgp: '0.00' }])}>{t('orders.addItem')}</Button>
      </div>
      {error && <Alert>{error}</Alert>}
      <Button disabled={!clientId || create.isPending} onClick={submit}>{create.isPending ? t('common.pleaseWait') : t('customs.newImport')}</Button>
    </Card>
  );
}

function ImportDetail({ importId }: { importId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const [eca, setEca] = useState('');
  const [locationId, setLocationId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const imp = useQuery({ queryKey: ['import', importId], queryFn: () => getImport(importId) });
  const landed = useQuery({ queryKey: ['landed', importId], queryFn: () => getLandedCost(importId) });
  const locations = useQuery({ queryKey: ['locations', imp.data?.warehouseId], queryFn: () => listLocations(imp.data!.warehouseId!), enabled: !!imp.data?.warehouseId });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['import', importId] }); void qc.invalidateQueries({ queryKey: ['landed', importId] }); void qc.invalidateQueries({ queryKey: ['imports'] }); };
  const onErr = (e: any) => setError(e?.response?.data?.message ?? t('customs.actionError'));

  const declare = useMutation({ mutationFn: () => declareImport(importId, eca), onSuccess: () => { setEca(''); setError(null); refresh(); }, onError: onErr });
  const inspect = useMutation({ mutationFn: () => inspectImport(importId), onSuccess: () => { setError(null); refresh(); }, onError: onErr });
  const clear = useMutation({ mutationFn: () => clearImport(importId), onSuccess: () => { setError(null); refresh(); }, onError: onErr });
  const release = useMutation({ mutationFn: () => releaseImport(importId, locationId), onSuccess: () => { setError(null); refresh(); }, onError: onErr });

  if (imp.isLoading || !imp.data) return <Spinner />;
  const s = imp.data;

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between text-sm"><dt className="text-muted">{label}</dt><dd>{value}</dd></div>
  );

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold" dir="ltr">{s.reference}</h2>
          <span className="flex gap-1"><Badge tone={TONE[s.status]}>{t(`customs.statuses.${s.status}`)}</Badge>{s.bonded && <Badge tone="amber">{t('customs.bonded')}</Badge>}</span>
        </div>
        <dl className="space-y-1">
          <Row label={t('orders.client')} value={s.client?.legalName ?? ''} />
          {s.originCountry && <Row label={t('customs.origin')} value={s.originCountry} />}
          {s.supplierName && <Row label={t('customs.supplier')} value={s.supplierName} />}
          {s.ecaDeclarationNumber && <Row label={t('customs.eca')} value={s.ecaDeclarationNumber} />}
        </dl>

        <table className="w-full text-sm border-t border-line-soft pt-2">
          <thead><tr className="text-muted"><th className="text-start font-medium py-1">SKU</th><th className="text-start font-medium py-1">HS</th><th className="text-end font-medium py-1">{t('orders.qty')}</th><th className="text-end font-medium py-1">{t('customs.unitCost')}</th></tr></thead>
          <tbody>
            {s.lines.map((l) => (
              <tr key={l.id} className="border-b border-line-soft">
                <td className="py-1" dir="ltr">{l.sku?.code}</td>
                <td className="py-1" dir="ltr">{l.hsCode} <span className="text-faint">({(l.dutyRateBps / 100).toFixed(1)}%)</span></td>
                <td className="py-1 text-end">{l.quantity}</td>
                <td className="py-1 text-end">{formatEgp(l.unitCostPiastres, { locale: egpLoc })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Landed cost */}
      <Card className="p-6">
        <h3 className="text-md font-semibold mb-2">{t('customs.landedCost')}</h3>
        {landed.isLoading ? <Spinner /> : landed.data && (
          <dl className="space-y-1 text-sm">
            <Row label={t('customs.goods')} value={formatEgp(landed.data.goodsTotalPiastres, { locale: egpLoc })} />
            <Row label={t('customs.freight')} value={formatEgp(landed.data.freightPiastres, { locale: egpLoc })} />
            <Row label={t('customs.insurance')} value={formatEgp(landed.data.insurancePiastres, { locale: egpLoc })} />
            <div className="flex justify-between text-sm border-t border-line-soft pt-1"><dt className="text-muted">{t('customs.cif')}</dt><dd>{formatEgp(landed.data.cifPiastres, { locale: egpLoc })}</dd></div>
            <Row label={t('customs.duties')} value={formatEgp(landed.data.totalDutyPiastres, { locale: egpLoc })} />
            <Row label={t('quote.vat', { pct: landed.data.vatRateBps / 100 })} value={formatEgp(landed.data.vatPiastres, { locale: egpLoc })} />
            <div className="flex justify-between font-semibold text-base border-t border-line pt-1"><dt>{t('customs.landedTotal')}</dt><dd>{formatEgp(landed.data.landedTotalPiastres, { locale: egpLoc })}</dd></div>
            {landed.data.dutyDeferred && <p className="text-xs text-amber-600 pt-1">{t('customs.dutyDeferred')}</p>}
          </dl>
        )}
      </Card>

      {/* Workflow */}
      <Card className="p-6 space-y-3">
        <h3 className="text-md font-semibold">{t('customs.workflow')}</h3>
        {error && <Alert>{error}</Alert>}
        {s.status === 'DRAFT' && (
          <div className="flex gap-2 items-end">
            <TextField label={t('customs.eca')} value={eca} onChange={(e) => setEca(e.target.value)} />
            <Button disabled={!eca || declare.isPending} onClick={() => declare.mutate()}>{t('customs.declare')}</Button>
          </div>
        )}
        {s.status === 'DECLARED' && <Button onClick={() => inspect.mutate()} disabled={inspect.isPending}>{t('customs.inspect')}</Button>}
        {s.status === 'UNDER_INSPECTION' && <Button onClick={() => clear.mutate()} disabled={clear.isPending}>{t('customs.clear')}</Button>}
        {s.status === 'CLEARED' && (
          <div className="flex gap-2 items-end">
            <Select label={t('inventory.location')} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">{s.warehouseId ? '—' : t('customs.noWarehouse')}</option>
              {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
            </Select>
            <Button disabled={!locationId || release.isPending} onClick={() => release.mutate()}>{t('customs.release')}</Button>
          </div>
        )}
        {s.status === 'RELEASED' && <p className="text-sm text-green-600">{t('customs.releasedNote')}</p>}
      </Card>
    </div>
  );
}
