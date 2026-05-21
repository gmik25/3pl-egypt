import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatEgp, GOVERNORATES } from '@3pl/shared';

import { getMyClient, getMyContracts } from '../api/portal';
import { Card, Spinner, Badge, Alert } from '../components/ui';
import { currentLocale } from '../i18n';

export default function ClientPortalPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';

  const client = useQuery({ queryKey: ['portal-client'], queryFn: getMyClient });
  const contracts = useQuery({ queryKey: ['portal-contracts'], queryFn: getMyContracts });

  if (client.isLoading) return <Spinner />;
  if (client.isError) {
    return (
      <div className="max-w-2xl">
        <Alert tone="amber">{t('portal.notLinked')}</Alert>
      </div>
    );
  }

  const gov = GOVERNORATES.find((g) => g.code === client.data?.governorate);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('portal.title')}</h1>
        <p className="text-slate-500 mt-1">{t('portal.subtitle')}</p>
      </div>

      <Card className="p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{client.data?.legalName}</h2>
          {client.data?.isActive ? (
            <Badge tone="green">{t('clients.active')}</Badge>
          ) : (
            <Badge tone="red">{t('clients.inactive')}</Badge>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-slate-500">{t('clients.governorate')}</dt>
            <dd>{locale === 'ar' ? gov?.nameAr : gov?.nameEn}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('clients.contactName')}</dt>
            <dd>{client.data?.contactName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('clients.contactEmail')}</dt>
            <dd>{client.data?.contactEmail}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('clients.contactPhone')}</dt>
            <dd dir="ltr" className="text-start">{client.data?.contactPhone}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-6 space-y-3">
        <h2 className="text-lg font-semibold">{t('contracts.title')}</h2>
        {contracts.isLoading ? (
          <Spinner />
        ) : contracts.data && contracts.data.length > 0 ? (
          <div className="space-y-2">
            {contracts.data.map((c) => (
              <div key={c.id} className="border border-slate-200 rounded-md p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{new Date(c.startsOn).toLocaleDateString()}</span>
                  {c.isActive ? (
                    <Badge tone="green">{t('contracts.activeBadge')}</Badge>
                  ) : (
                    <Badge tone="slate">{t('contracts.inactiveBadge')}</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-slate-600">
                  <span>{t('contracts.storageEgp')}: {formatEgp(c.storagePerSkuPerDayPiastres, { locale: egpLoc })}</span>
                  <span>{t('contracts.pickPackEgp')}: {formatEgp(c.pickAndPackPiastres, { locale: egpLoc })}</span>
                  <span>{t('contracts.codCommissionPct')}: {(c.codCommissionBps / 100).toFixed(2)}%</span>
                  <span>{t('contracts.returnFeeEgp')}: {formatEgp(c.returnFeePiastres, { locale: egpLoc })}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">{t('contracts.none')}</p>
        )}
      </Card>
    </div>
  );
}
