import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { listUsers } from '../api/users';
import { USER_ROLES, type UserRole } from '@3pl/shared';
import { Button, Card, Select, TextField, Spinner, Badge } from '../components/ui';
import { currentLocale } from '../i18n';

const PAGE_SIZE = 25;

export default function UsersPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', { search, role, page }],
    queryFn: () =>
      listUsers({
        search: search || undefined,
        role: role || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('users.title')}</h1>
        <Link to="/users/new">
          <Button>{t('users.create')}</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextField
            label={t('users.search')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('users.searchPlaceholder')}
          />
          <Select
            label={t('users.role')}
            value={role}
            onChange={(e) => {
              setRole(e.target.value as UserRole | '');
              setPage(1);
            }}
          >
            <option value="">{t('common.all')}</option>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
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
                <tr className="text-start text-slate-500 border-b border-slate-200">
                  <th className="text-start font-medium px-4 py-3">{t('users.name')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('users.email')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('users.roles')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('users.status')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/users/${u.id}`} className="text-brand-600 hover:underline font-medium">
                        {u.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.roles.map((r) => (
                          <Badge key={r.role.name} tone="blue">
                            {t(`roles.${r.role.name}`)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <Badge tone="green">{t('users.active')}</Badge>
                      ) : (
                        <Badge tone="red">{t('users.inactive')}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
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
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG').format(data.total)}{' '}
            {t('users.totalUsers')}
          </span>
          <div className="flex items-center gap-2">
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
        </div>
      )}
    </div>
  );
}
