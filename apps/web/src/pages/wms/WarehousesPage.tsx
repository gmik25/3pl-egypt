import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';

import {
  allocateLocations,
  createWarehouse,
  createZone,
  generateLocations,
  getAllocationSummary,
  getWarehouse,
  listLocations,
  listWarehouses,
  type LocationFilters,
} from '../../api/wms';
import { listClients } from '../../api/clients';
import type { LocationKind, WmsLocation, ZoneType } from '../../types';
import { Button, Card, Select, TextField, Spinner, Badge, Alert } from '../../components/ui';
import { currentLocale } from '../../i18n';

/** Split a comma/space/newline separated list into trimmed tokens. */
function parseTokens(s: string): string[] {
  return Array.from(new Set(s.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean)));
}

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
  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ isActive: true, pageSize: 200 }) });

  const [zoneType, setZoneType] = useState<ZoneType>('STORAGE');
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['warehouse', warehouseId] });
    void qc.invalidateQueries({ queryKey: ['locations', warehouseId] });
    void qc.invalidateQueries({ queryKey: ['allocations', warehouseId] });
    void qc.invalidateQueries({ queryKey: ['warehouses'] });
  };
  const addZone = useMutation({ mutationFn: () => createZone(warehouseId, { type: zoneType, code: zoneCode, name: zoneName }), onSuccess: () => { setZoneCode(''); setZoneName(''); invalidate(); } });

  if (wh.isLoading || !wh.data) return <Spinner />;
  const clientOptions = clients.data?.items ?? [];

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{wh.data.name} <span className="text-slate-400" dir="ltr">({wh.data.code})</span></h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {wh.data.zones.map((z) => (
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

      <GenerateGridForm warehouseId={warehouseId} zones={wh.data.zones} clientOptions={clientOptions} onDone={invalidate} />
      <AllocationSummaryCard warehouseId={warehouseId} />
      <LocationsTable warehouseId={warehouseId} zones={wh.data.zones} clientOptions={clientOptions} onChanged={invalidate} />
    </div>
  );
}

type ZoneOpt = { id: string; type: ZoneType; code: string };
type ClientOpt = { id: string; legalName: string };

function GenerateGridForm({ warehouseId, zones, clientOptions, onDone }: { warehouseId: string; zones: ZoneOpt[]; clientOptions: ClientOpt[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [zoneId, setZoneId] = useState('');
  const [type, setType] = useState<LocationKind>('BIN');
  const [aisles, setAisles] = useState('A');
  const [racks, setRacks] = useState('01,02,03');
  const [levels, setLevels] = useState('1,2,3');
  const [bins, setBins] = useState('01,02,03,04');
  const [capacity, setCapacity] = useState('100');
  const [allocatedClientId, setAllocatedClientId] = useState('');
  const [open, setOpen] = useState(false);

  const count = parseTokens(aisles).length * parseTokens(racks).length * parseTokens(levels).length * parseTokens(bins).length;

  const gen = useMutation({
    mutationFn: () => generateLocations(warehouseId, {
      zoneId, type,
      aisles: parseTokens(aisles), racks: parseTokens(racks), levels: parseTokens(levels), bins: parseTokens(bins),
      capacityUnits: capacity ? Number(capacity) : undefined,
      allocatedClientId: allocatedClientId || undefined,
    }),
    onSuccess: onDone,
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-md font-semibold">{t('warehouses.generateGrid')}</h3>
        <Button variant="secondary" onClick={() => setOpen((o) => !o)}>{open ? t('common.cancel') : t('warehouses.generateGrid')}</Button>
      </div>
      {open && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Select label={t('warehouses.zone')} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">—</option>
              {zones.map((z) => <option key={z.id} value={z.id}>{z.code} ({t(`warehouses.zoneTypes.${z.type}`)})</option>)}
            </Select>
            <Select label={t('warehouses.locationKind')} value={type} onChange={(e) => setType(e.target.value as LocationKind)}>
              {LOCATION_KINDS.map((k) => <option key={k} value={k}>{t(`warehouses.kinds.${k}`)}</option>)}
            </Select>
            <Select label={t('warehouses.allocateTo')} value={allocatedClientId} onChange={(e) => setAllocatedClientId(e.target.value)}>
              <option value="">{t('warehouses.unallocated')}</option>
              {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TextField label={t('warehouses.aisles')} value={aisles} onChange={(e) => setAisles(e.target.value)} dir="ltr" />
            <TextField label={t('warehouses.racks')} value={racks} onChange={(e) => setRacks(e.target.value)} dir="ltr" />
            <TextField label={t('warehouses.levels')} value={levels} onChange={(e) => setLevels(e.target.value)} dir="ltr" />
            <TextField label={t('warehouses.bins')} value={bins} onChange={(e) => setBins(e.target.value)} dir="ltr" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TextField label={t('warehouses.capacityPerBin')} type="number" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} dir="ltr" />
          </div>
          <p className="text-xs text-slate-500">{t('warehouses.gridHint', { count })}</p>
          {gen.isError && <Alert>{t('warehouses.gridError')}</Alert>}
          {gen.isSuccess && <Alert tone="green">{t('warehouses.gridDone', { created: gen.data.created, skipped: gen.data.skipped })}</Alert>}
          <Button disabled={!zoneId || count === 0 || count > 5000 || gen.isPending} onClick={() => gen.mutate()}>
            {gen.isPending ? t('common.pleaseWait') : t('warehouses.generate')}
          </Button>
        </div>
      )}
    </Card>
  );
}

function AllocationSummaryCard({ warehouseId }: { warehouseId: string }) {
  const { t } = useTranslation();
  const summary = useQuery({ queryKey: ['allocations', warehouseId], queryFn: () => getAllocationSummary(warehouseId) });
  return (
    <Card className="p-6">
      <h3 className="text-md font-semibold mb-3">{t('warehouses.allocationsBySeller')}</h3>
      {summary.isLoading ? <Spinner /> : summary.data && summary.data.length > 0 ? (
        <div className="space-y-1.5">
          {summary.data.map((r) => (
            <div key={r.clientId} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1.5">
              <span className="font-medium">{r.legalName}</span>
              <span className="text-slate-500">
                <Badge tone="blue">{t('warehouses.locationsCount', { count: r.locationCount })}</Badge>
                {r.reservedCapacity > 0 && (
                  <span className="ms-2 text-xs">{t('warehouses.utilization', { stored: r.storedUnits, capacity: r.reservedCapacity, pct: r.utilizationPct ?? 0 })}</span>
                )}
                <span className="ms-2 text-xs text-slate-400">{t('warehouses.occupiedOf', { occupied: r.occupiedCount, total: r.locationCount })}</span>
              </span>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-slate-400">{t('warehouses.noAllocations')}</p>}
    </Card>
  );
}

function LocationsTable({ warehouseId, zones, clientOptions, onChanged }: { warehouseId: string; zones: ZoneOpt[]; clientOptions: ClientOpt[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<LocationFilters>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignClientId, setAssignClientId] = useState('');

  const locs = useQuery({ queryKey: ['locations', warehouseId, filters], queryFn: () => listLocations(warehouseId, filters) });
  const clientName = (id: string) => clientOptions.find((c) => c.id === id)?.legalName ?? id;

  const allocate = useMutation({
    mutationFn: (clientId: string | null) => allocateLocations({ clientId, locationIds: Array.from(selected) }),
    onSuccess: () => { setSelected(new Set()); onChanged(); },
  });

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const rows = locs.data ?? [];
  const allSelected = rows.length > 0 && rows.every((l) => selected.has(l.id));

  return (
    <Card className="p-6">
      <h3 className="text-md font-semibold mb-3">{t('warehouses.locations')}</h3>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <Select label={t('warehouses.zone')} value={filters.zoneId ?? ''} onChange={(e) => setFilters((f) => ({ ...f, zoneId: e.target.value || undefined }))}>
          <option value="">{t('common.all')}</option>
          {zones.map((z) => <option key={z.id} value={z.id}>{z.code}</option>)}
        </Select>
        <Select label={t('warehouses.allocateTo')} value={filters.unallocated ? '__none' : (filters.allocatedClientId ?? '')} onChange={(e) => {
          const v = e.target.value;
          setFilters((f) => ({ ...f, allocatedClientId: v && v !== '__none' ? v : undefined, unallocated: v === '__none' || undefined }));
        }}>
          <option value="">{t('common.all')}</option>
          <option value="__none">{t('warehouses.unallocated')}</option>
          {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
        </Select>
        <TextField label={t('warehouses.search')} value={filters.q ?? ''} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))} dir="ltr" />
      </div>

      {/* Bulk allocate bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-brand-50 rounded-md">
          <span className="text-sm text-brand-700">{t('warehouses.selectedCount', { count: selected.size })}</span>
          <Select value={assignClientId} onChange={(e) => setAssignClientId(e.target.value)} className="!w-48">
            <option value="">{t('warehouses.chooseSeller')}</option>
            {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
          <Button disabled={!assignClientId || allocate.isPending} onClick={() => allocate.mutate(assignClientId)}>{t('warehouses.allocate')}</Button>
          <Button variant="secondary" disabled={allocate.isPending} onClick={() => allocate.mutate(null)}>{t('warehouses.release')}</Button>
        </div>
      )}

      {locs.isLoading ? <Spinner /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="px-2 py-2"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((l) => l.id)) : new Set())} /></th>
                <th className="text-start font-medium px-3 py-2">{t('warehouses.code')}</th>
                <th className="text-start font-medium px-3 py-2">{t('warehouses.zone')}</th>
                <th className="text-start font-medium px-3 py-2">{t('warehouses.allocatedTo')}</th>
                <th className="text-start font-medium px-3 py-2">{t('warehouses.capacity')}</th>
                <th className="text-start font-medium px-3 py-2">{t('warehouses.occupancy')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l: WmsLocation) => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-2 py-2"><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} /></td>
                  <td className="px-3 py-2 font-medium" dir="ltr">{l.code}</td>
                  <td className="px-3 py-2 text-slate-500">{l.zone ? t(`warehouses.zoneTypes.${l.zone.type}`) : '—'}</td>
                  <td className="px-3 py-2">{l.allocatedClientId ? <Badge tone="blue">{l.allocatedClient?.legalName ?? clientName(l.allocatedClientId)}</Badge> : <span className="text-slate-400">{t('warehouses.unallocated')}</span>}</td>
                  <td className="px-3 py-2 text-slate-500">{l.capacityUnits != null ? `${l.units ?? 0}/${l.capacityUnits}${l.utilizationPct != null ? ` · ${l.utilizationPct}%` : ''}` : '—'}</td>
                  <td className="px-3 py-2">{l.occupied ? <Badge tone="amber">{t('warehouses.occupiedUnits', { count: l.units ?? 0 })}</Badge> : <span className="text-slate-400">{t('warehouses.empty')}</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400">{t('common.noResults')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
