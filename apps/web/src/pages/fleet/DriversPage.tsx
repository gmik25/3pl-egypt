import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';

import { listUsers } from '../../api/users';
import { listDrivers, registerDriver, updateDriver } from '../../api/fleet';
import { Button, Card, Select, TextField, Spinner, Badge } from '../../components/ui';
import { currentLocale } from '../../i18n';

export default function DriversPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const drivers = useQuery({ queryKey: ['drivers'], queryFn: () => listDrivers() });

  const toggleAvail = useMutation({
    mutationFn: (v: { userId: string; isAvailable: boolean }) => updateDriver(v.userId, { isAvailable: v.isAvailable }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['drivers'] }),
  });

  const govName = (c: GovernorateCode) => {
    const g = GOVERNORATES.find((x) => x.code === c);
    return locale === 'ar' ? g?.nameAr : g?.nameEn;
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('drivers.title')}</h1>
        <Button onClick={() => setShowNew((o) => !o)}>{showNew ? t('common.cancel') : t('drivers.register')}</Button>
      </div>

      {showNew && <RegisterDriverForm onDone={() => { setShowNew(false); void qc.invalidateQueries({ queryKey: ['drivers'] }); }} />}

      <Card>
        {drivers.isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-start font-medium px-4 py-3">{t('drivers.name')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('drivers.vehicle')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('drivers.zones')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('drivers.availability')}</th>
                </tr>
              </thead>
              <tbody>
                {drivers.data?.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-medium">{d.user?.fullName}<span className="block text-xs text-slate-400" dir="ltr">{d.user?.phone}</span></td>
                    <td className="px-4 py-3 text-slate-600">{d.vehicleType ?? '—'}{d.plateNumber && <span className="text-slate-400" dir="ltr"> · {d.plateNumber}</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {d.zones.length ? d.zones.map((z) => <Badge key={z} tone="slate">{govName(z)}</Badge>) : <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleAvail.mutate({ userId: d.userId, isAvailable: !d.isAvailable })} className="cursor-pointer">
                        {d.isAvailable ? <Badge tone="green">{t('drivers.available')}</Badge> : <Badge tone="red">{t('drivers.unavailable')}</Badge>}
                      </button>
                    </td>
                  </tr>
                ))}
                {drivers.data?.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t('common.noResults')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function RegisterDriverForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [userId, setUserId] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [zones, setZones] = useState<GovernorateCode[]>([]);

  const driverUsers = useQuery({ queryKey: ['users', 'drivers'], queryFn: () => listUsers({ role: 'DRIVER', pageSize: 100 }) });

  const register = useMutation({
    mutationFn: () => registerDriver({ userId, vehicleType: vehicleType || undefined, plateNumber: plateNumber || undefined, zones }),
    onSuccess: onDone,
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select label={t('drivers.user')} value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">—</option>
          {driverUsers.data?.items.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </Select>
        <TextField label={t('drivers.vehicle')} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
        <TextField label={t('drivers.plate')} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} />
      </div>
      <div>
        <span className="block text-sm font-medium text-slate-700 mb-1">{t('drivers.zones')}</span>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded p-2">
          {GOVERNORATES.map((g) => (
            <label key={g.code} className="flex items-center gap-1 text-xs border border-slate-200 rounded px-2 py-1 cursor-pointer">
              <input type="checkbox" checked={zones.includes(g.code)} onChange={(e) => setZones((prev) => e.target.checked ? [...prev, g.code] : prev.filter((x) => x !== g.code))} />
              {locale === 'ar' ? g.nameAr : g.nameEn}
            </label>
          ))}
        </div>
      </div>
      {driverUsers.data?.items.length === 0 && <p className="text-xs text-amber-600">{t('drivers.noDriverUsers')}</p>}
      <Button disabled={!userId || register.isPending} onClick={() => register.mutate()}>{register.isPending ? t('common.pleaseWait') : t('drivers.register')}</Button>
    </Card>
  );
}
