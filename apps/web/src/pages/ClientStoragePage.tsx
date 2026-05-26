import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';

import { getMyAllocations } from '../api/wms';
import { Card, Spinner, Badge } from '../components/ui';
import { currentLocale } from '../i18n';

export default function ClientStoragePage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const allocations = useQuery({ queryKey: ['my-allocations'], queryFn: getMyAllocations });

  const govName = (code: GovernorateCode) => {
    const g = GOVERNORATES.find((x) => x.code === code);
    return locale === 'ar' ? g?.nameAr : g?.nameEn;
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t('myStorage.title')}</h1>
        <p className="text-sm text-slate-500">{t('myStorage.subtitle')}</p>
      </div>

      {allocations.isLoading ? (
        <Spinner />
      ) : allocations.data && allocations.data.length > 0 ? (
        allocations.data.map((g) => {
          const occupied = g.locations.filter((l) => l.units > 0).length;
          return (
            <Card key={g.warehouse.id} className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">
                  {g.warehouse.name} <span className="text-slate-400" dir="ltr">({g.warehouse.code})</span>
                  <span className="block text-xs text-slate-400">{govName(g.warehouse.governorate)}</span>
                </h2>
                <div className="text-end text-sm">
                  <Badge tone="blue">{t('myStorage.locationsCount', { count: g.locations.length })}</Badge>
                  <span className="block text-xs text-slate-400 mt-1">{t('myStorage.occupiedOf', { occupied, total: g.locations.length })}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.locations.map((l) => (
                  <span
                    key={l.id}
                    className={`text-xs border rounded px-2 py-1 ${l.units > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600'}`}
                    dir="ltr"
                    title={l.units > 0 ? t('myStorage.occupiedUnits', { count: l.units }) : t('warehouses.empty')}
                  >
                    {l.code}
                  </span>
                ))}
              </div>
            </Card>
          );
        })
      ) : (
        <Card className="p-8 text-center text-slate-400 text-sm">{t('myStorage.empty')}</Card>
      )}
    </div>
  );
}
