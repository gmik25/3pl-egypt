import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { listClients } from '../api/clients';
import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';
import { Button, Card, Select, TextField, Spinner, Badge } from '../components/ui';
import { currentLocale } from '../i18n';

const PAGE_SIZE = 25;

export default function ClientsPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [search, setSearch] = useState('');
  const [governorate, setGovernorate] = useState<GovernorateCode | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['clients', { search, governorate, page }],
    queryFn: () =>
      listClients({
        search: search || undefined,
        governorate: governorate || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('clients.title')}</h1>
        <Link to="/clients/new">
          <Button>{t('clients.create')}</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextField
            label={t('clients.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('clients.searchPlaceholder')}
          />
          <Select
            label={t('clients.governorate')}
            value={governorate}
            onChange={(e) => {
              setGovernorate(e.target.value as GovernorateCode | '');
              setPage(1);
            }}
          >
            <option value="">{t('common.all')}</option>
            {GOVERNORATES.map((g) => (
              <option key={g.code} value={g.code}>
                {locale === 'ar' ? g.nameAr : g.nameEn}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <Spinner />
        ) : isError ? (
          <p className="p-6 text-red-600 text-sm">{t('common.loadError')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('clients.legalName')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('clients.governorate')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('clients.contact')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('clients.contracts')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('clients.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((c) => {
                  const gov = GOVERNORATES.find((g) => g.code === c.governorate);
                  return (
                    <tr key={c.id} className="border-b border-line-soft hover:bg-surface-muted">
                      <td className="px-4 py-3">
                        <Link to={`/clients/${c.id}`} className="text-accent hover:underline font-medium">
                          {c.legalName}
                        </Link>
                        {c.tradingName && <span className="text-faint block text-xs">{c.tradingName}</span>}
                      </td>
                      <td className="px-4 py-3 text-body">{locale === 'ar' ? gov?.nameAr : gov?.nameEn}</td>
                      <td className="px-4 py-3 text-body">
                        {c.contactName}
                        <span className="block text-xs text-faint">{c.contactPhone}</span>
                      </td>
                      <td className="px-4 py-3 text-body">{c._count?.contracts ?? 0}</td>
                      <td className="px-4 py-3">
                        {c.isActive ? (
                          <Badge tone="green">{t('clients.active')}</Badge>
                        ) : (
                          <Badge tone="red">{t('clients.inactive')}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-faint">
                      {t('common.noResults')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('common.previous')}
          </Button>
          <span>
            {page} / {totalPages}
          </span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t('common.next')}
          </Button>
        </div>
      )}
    </div>
  );
}
