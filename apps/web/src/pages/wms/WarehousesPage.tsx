import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';

import {
  createLocation,
  createWarehouse,
  createZone,
  getWarehouse,
  listLocations,
  listWarehouses,
} from '../../api/wms';
import type { LocationKind, ZoneType } from '../../types';
import { Button, Card, Select, TextField, Spinner, Badge } from '../../components/ui';
import { currentLocale } from '../../i18n';

const ZONE_TYPES: ZoneType[] = ['RECEIVING', 'STORAGE', 'PACKING', 'DISPATCH'];
const LOCATION_KINDS: LocationKind[] = ['BIN', 'RACK', 'SHELF', 'FLOOR'];

export default function WarehousesPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [showNewWh, setShowNewWh] = useState(false);

  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });

  const newWh = useMutation({
    mutationFn: (input: { code: string; name: string; governorate: GovernorateCode }) => createWarehouse(input),
    onSuccess: () => { setShowNewWh(false); void qc.invalidateQueries({ queryKey: ['warehouses'] }); },
  });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('warehouses.title')}</h1>
        <Button onClick={() => setShowNewWh((s) => !s)}>{showNewWh ? t('common.cancel') : t('warehouses.create')}</Button>
      </div>

      {showNewWh && <NewWarehouseForm onSubmit={(v) => newWh.mutate(v)} pending={newWh.isPending} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-3 lg:col-span-1">
          {warehouses.isLoading ? <Spinner /> : (
            <ul className="space-y-1">
              {warehouses.data?.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => setSelected(w.id)}
                    className={`w-full text-start px-3 py-2 rounded-md text-sm transition ${selected === w.id ? 'bg-brand-50 text-brand-700 font-medium' : 'hover:bg-slate-100'}`}
                  >
                    <span className="font-medium" dir="ltr">{w.code}</span> — {w.name}
                    <span className="block text-xs text-slate-400">
                      {GOVERNORATES.find((g) => g.code === w.governorate)?.[locale === 'ar' ? 'nameAr' : 'nameEn']} · {w._count?.locations ?? 0} {t('warehouses.locations')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-2">
          {selected ? <WarehouseDetail warehouseId={selected} /> : <Card className="p-8 text-center text-slate-400 text-sm">{t('warehouses.selectPrompt')}</Card>}
        </div>
      </div>
    </div>
  );
}

function NewWarehouseForm({ onSubmit, pending }: { onSubmit: (v: { code: string; name: string; governorate: GovernorateCode }) => void; pending: boolean }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [governorate, setGovernorate] = useState<GovernorateCode>('C');
  return (
    <Card className="p-6">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ code, name, governorate }); }} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <TextField label={t('warehouses.code')} required value={code} onChange={(e) => setCode(e.target.value)} />
        <TextField label={t('warehouses.name')} required value={name} onChange={(e) => setName(e.target.value)} />
        <Select label={t('clients.governorate')} value={governorate} onChange={(e) => setGovernorate(e.target.value as GovernorateCode)}>
          {GOVERNORATES.map((g) => <option key={g.code} value={g.code}>{locale === 'ar' ? g.nameAr : g.nameEn}</option>)}
        </Select>
        <Button type="submit" disabled={pending}>{t('common.save')}</Button>
      </form>
    </Card>
  );
}

function WarehouseDetail({ warehouseId }: { warehouseId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const wh = useQuery({ queryKey: ['warehouse', warehouseId], queryFn: () => getWarehouse(warehouseId) });
  const locs = useQuery({ queryKey: ['locations', warehouseId], queryFn: () => listLocations(warehouseId) });

  const [zoneType, setZoneType] = useState<ZoneType>('STORAGE');
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [locZoneId, setLocZoneId] = useState('');
  const [locCode, setLocCode] = useState('');
  const [locKind, setLocKind] = useState<LocationKind>('BIN');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['warehouse', warehouseId] });
    void qc.invalidateQueries({ queryKey: ['locations', warehouseId] });
    void qc.invalidateQueries({ queryKey: ['warehouses'] });
  };
  const addZone = useMutation({ mutationFn: () => createZone(warehouseId, { type: zoneType, code: zoneCode, name: zoneName }), onSuccess: () => { setZoneCode(''); setZoneName(''); invalidate(); } });
  const addLoc = useMutation({ mutationFn: () => createLocation(warehouseId, { zoneId: locZoneId, code: locCode, type: locKind }), onSuccess: () => { setLocCode(''); invalidate(); } });

  if (wh.isLoading) return <Spinner />;

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{wh.data?.name} <span className="text-slate-400" dir="ltr">({wh.data?.code})</span></h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {wh.data?.zones.map((z) => (
            <Badge key={z.id} tone="blue">{t(`warehouses.zoneTypes.${z.type}`)} · {z.code} ({z._count?.locations ?? 0})</Badge>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); addZone.mutate(); }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end border-t border-slate-100 pt-3">
          <Select label={t('warehouses.zoneType')} value={zoneType} onChange={(e) => setZoneType(e.target.value as ZoneType)}>
            {ZONE_TYPES.map((z) => <option key={z} value={z}>{t(`warehouses.zoneTypes.${z}`)}</option>)}
          </Select>
          <TextField label={t('warehouses.code')} required value={zoneCode} onChange={(e) => setZoneCode(e.target.value)} />
          <TextField label={t('warehouses.name')} required value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
          <Button type="submit" variant="secondary" disabled={addZone.isPending}>{t('warehouses.addZone')}</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h3 className="text-md font-semibold mb-3">{t('warehouses.locations')}</h3>
        <form onSubmit={(e) => { e.preventDefault(); addLoc.mutate(); }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end mb-4">
          <Select label={t('warehouses.zone')} required value={locZoneId} onChange={(e) => setLocZoneId(e.target.value)}>
            <option value="">—</option>
            {wh.data?.zones.map((z) => <option key={z.id} value={z.id}>{z.code} ({t(`warehouses.zoneTypes.${z.type}`)})</option>)}
          </Select>
          <TextField label={t('warehouses.code')} required value={locCode} onChange={(e) => setLocCode(e.target.value)} />
          <Select label={t('warehouses.locationKind')} value={locKind} onChange={(e) => setLocKind(e.target.value as LocationKind)}>
            {LOCATION_KINDS.map((k) => <option key={k} value={k}>{t(`warehouses.kinds.${k}`)}</option>)}
          </Select>
          <Button type="submit" variant="secondary" disabled={addLoc.isPending || !locZoneId}>{t('warehouses.addLocation')}</Button>
        </form>
        {locs.isLoading ? <Spinner /> : (
          <div className="flex flex-wrap gap-2">
            {locs.data?.map((l) => (
              <span key={l.id} className="text-xs border border-slate-200 rounded px-2 py-1" dir="ltr">
                {l.code} <span className="text-slate-400">{l.barcode ? `· ${l.barcode}` : ''}</span>
              </span>
            ))}
            {locs.data?.length === 0 && <span className="text-sm text-slate-400">{t('common.noResults')}</span>}
          </div>
        )}
      </Card>
    </div>
  );
}
