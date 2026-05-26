import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { listAudit } from '../api/audit';
import type { AuditAction } from '../types';
import { Button, Card, Select, TextField, Spinner, Badge } from '../components/ui';
import { currentLocale } from '../i18n';

const ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'MFA_ENROL',
  'MFA_VERIFY',
  'STATE_TRANSITION',
];

const ACTION_TONE: Record<AuditAction, 'green' | 'blue' | 'red' | 'amber' | 'slate'> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN: 'slate',
  LOGOUT: 'slate',
  MFA_ENROL: 'amber',
  MFA_VERIFY: 'amber',
  STATE_TRANSITION: 'blue',
};

const PAGE_SIZE = 25;

export default function AuditPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const [action, setAction] = useState<AuditAction | ''>('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['audit', { action, entity, page }],
    queryFn: () =>
      listAudit({
        action: action || undefined,
        entity: entity || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Africa/Cairo',
    }).format(new Date(iso));

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">{t('audit.title')}</h1>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            label={t('audit.action')}
            value={action}
            onChange={(e) => {
              setAction(e.target.value as AuditAction | '');
              setPage(1);
            }}
          >
            <option value="">{t('common.all')}</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {t(`audit.actions.${a}`)}
              </option>
            ))}
          </Select>
          <TextField
            label={t('audit.entity')}
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            placeholder="user, order, client…"
          />
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
                  <th className="text-start font-medium px-4 py-3">{t('audit.when')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('audit.actor')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('audit.action')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('audit.entity')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((e) => (
                  <tr key={e.id} className="border-b border-line-soft hover:bg-surface-muted">
                    <td className="px-4 py-3 text-body whitespace-nowrap">{fmtDate(e.createdAt)}</td>
                    <td className="px-4 py-3">{e.user?.fullName ?? e.user?.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={ACTION_TONE[e.action]}>{t(`audit.actions.${e.action}`)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {e.entity}
                      {e.entityId && <span className="text-faint"> · {e.entityId.slice(0, 8)}</span>}
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-faint">
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
