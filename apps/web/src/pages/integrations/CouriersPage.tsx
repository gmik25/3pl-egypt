import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';

import {
  createCourier,
  getCourier,
  listCouriers,
  setCourierCoverage,
  testCourierConnection,
  updateCourier,
  type CoverageEntry,
} from '../../api/integrations';
import type { CourierTestResult } from '../../types';
import { Button, Card, TextField, Spinner, Badge, Alert } from '../../components/ui';
import { currentLocale } from '../../i18n';

export default function CouriersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const couriers = useQuery({ queryKey: ['couriers'], queryFn: listCouriers });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('couriers.title')}</h1>
          <p className="text-sm text-muted">{t('couriers.subtitle')}</p>
        </div>
        <Button onClick={() => setShowNew((o) => !o)}>{showNew ? t('common.cancel') : t('couriers.onboard')}</Button>
      </div>

      {showNew && (
        <OnboardForm
          onDone={(id) => {
            setShowNew(false);
            void qc.invalidateQueries({ queryKey: ['couriers'] });
            setSelectedId(id);
          }}
        />
      )}

      <Card>
        {couriers.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('couriers.code')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('couriers.name')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('couriers.credentials')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('couriers.coverage')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('couriers.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {couriers.data?.map((c) => (
                  <tr key={c.id} className="border-b border-line-soft hover:bg-surface-muted">
                    <td className="px-4 py-3 font-medium" dir="ltr">{c.code}</td>
                    <td className="px-4 py-3">{c.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={c.hasApiKey ? 'green' : 'slate'}>{t('couriers.apiKey')}</Badge>
                        <Badge tone={c.hasWebhookSecret ? 'green' : 'slate'}>{t('couriers.webhook')}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body">
                      {t('couriers.govCount', { count: c._count?.coverage ?? 0 })}
                      <span className="block text-xs text-faint">{t('couriers.shipmentCount', { count: c._count?.shipments ?? 0 })}</span>
                    </td>
                    <td className="px-4 py-3">
                      {c.isActive ? <Badge tone="green">{t('couriers.active')}</Badge> : <Badge tone="red">{t('couriers.inactive')}</Badge>}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button variant="secondary" onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}>
                        {selectedId === c.id ? t('common.close') : t('couriers.manage')}
                      </Button>
                    </td>
                  </tr>
                ))}
                {couriers.data?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-faint">{t('common.noResults')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedId && <CourierEditor key={selectedId} id={selectedId} onChanged={() => void qc.invalidateQueries({ queryKey: ['couriers'] })} />}
    </div>
  );
}

function OnboardForm({ onDone }: { onDone: (id: string) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');

  const create = useMutation({
    mutationFn: () =>
      createCourier({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        apiBaseUrl: apiBaseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      }),
    onSuccess: (c) => onDone(c.id),
  });

  const codeValid = /^[A-Z0-9_]{2,20}$/.test(code.trim().toUpperCase());

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField
          label={t('couriers.code')}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="SPEEDAF"
          dir="ltr"
          error={code && !codeValid ? t('couriers.codeHint') : undefined}
        />
        <TextField label={t('couriers.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Speedaf Express" />
      </div>
      <TextField label={t('couriers.apiBaseUrl')} value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://api.courier.com" dir="ltr" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label={t('couriers.apiKey')} type="password" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} dir="ltr" />
        <TextField label={t('couriers.webhookSecret')} type="password" autoComplete="new-password" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} dir="ltr" />
      </div>
      <p className="text-xs text-muted">{t('couriers.secretsNote')}</p>
      {create.isError && <Alert>{t('couriers.createError')}</Alert>}
      <Button disabled={!codeValid || !name.trim() || create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? t('common.pleaseWait') : t('couriers.onboard')}
      </Button>
    </Card>
  );
}

function CourierEditor({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const courier = useQuery({ queryKey: ['courier', id], queryFn: () => getCourier(id) });

  const [name, setName] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [testResult, setTestResult] = useState<CourierTestResult | null>(null);

  useEffect(() => {
    if (courier.data) {
      setName(courier.data.name);
      setApiBaseUrl(courier.data.apiBaseUrl ?? '');
    }
  }, [courier.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['courier', id] });
    onChanged();
  };

  const save = useMutation({
    mutationFn: () =>
      updateCourier(id, {
        name: name.trim(),
        apiBaseUrl: apiBaseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      }),
    onSuccess: () => {
      setApiKey('');
      setWebhookSecret('');
      refresh();
    },
  });

  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => updateCourier(id, { isActive }),
    onSuccess: refresh,
  });

  const test = useMutation({
    mutationFn: () => testCourierConnection(id),
    onSuccess: (r) => setTestResult(r),
  });

  if (courier.isLoading || !courier.data) {
    return <Card className="p-6"><Spinner /></Card>;
  }
  const c = courier.data;

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          <span dir="ltr">{c.code}</span> · {c.name}
        </h2>
        <button onClick={() => toggleActive.mutate(!c.isActive)} className="cursor-pointer" disabled={toggleActive.isPending}>
          {c.isActive ? <Badge tone="green">{t('couriers.active')}</Badge> : <Badge tone="red">{t('couriers.inactive')}</Badge>}
        </button>
      </div>

      {/* Credentials */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-ink">{t('couriers.connection')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label={t('couriers.name')} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label={t('couriers.apiBaseUrl')} value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} dir="ltr" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            label={`${t('couriers.apiKey')} ${c.hasApiKey ? t('couriers.configured') : ''}`}
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={c.hasApiKey ? '••••••••' : ''}
            dir="ltr"
          />
          <TextField
            label={`${t('couriers.webhookSecret')} ${c.hasWebhookSecret ? t('couriers.configured') : ''}`}
            type="password"
            autoComplete="new-password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder={c.hasWebhookSecret ? '••••••••' : ''}
            dir="ltr"
          />
        </div>
        <p className="text-xs text-muted">{t('couriers.rotateNote')}</p>
        <div className="flex gap-2">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? t('common.pleaseWait') : t('common.save')}</Button>
          <Button variant="secondary" disabled={test.isPending} onClick={() => test.mutate()}>{t('couriers.testConnection')}</Button>
        </div>
        {testResult && (
          <Alert tone={testResult.ok ? 'green' : 'red'}>
            {testResult.ok ? t('couriers.testOk') : t('couriers.testFail')} — {testResult.note}
          </Alert>
        )}
      </div>

      <CoverageEditor id={id} onSaved={refresh} />
    </Card>
  );
}

function CoverageEditor({ id, onSaved }: { id: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const courier = useQuery({ queryKey: ['courier', id], queryFn: () => getCourier(id) });

  // Map of governorate -> { serviceable, etaDays }, seeded from existing coverage.
  const [rows, setRows] = useState<Record<string, { on: boolean; eta: number }>>({});

  useEffect(() => {
    if (!courier.data) return;
    const next: Record<string, { on: boolean; eta: number }> = {};
    for (const g of GOVERNORATES) {
      const cov = courier.data.coverage?.find((x) => x.governorate === g.code);
      next[g.code] = { on: cov ? cov.isServiceable : false, eta: cov?.etaDays ?? 2 };
    }
    setRows(next);
  }, [courier.data]);

  const save = useMutation({
    mutationFn: () => {
      const entries: CoverageEntry[] = GOVERNORATES.filter((g) => rows[g.code]?.on || courier.data?.coverage?.some((x) => x.governorate === g.code)).map(
        (g) => ({ governorate: g.code as GovernorateCode, etaDays: rows[g.code]?.eta ?? 2, isServiceable: rows[g.code]?.on ?? false }),
      );
      return setCourierCoverage(id, entries);
    },
    onSuccess: onSaved,
  });

  const set = (code: string, patch: Partial<{ on: boolean; eta: number }>) =>
    setRows((prev) => ({ ...prev, [code]: { ...(prev[code] ?? { on: false, eta: 2 }), ...patch } }));

  const activeCount = Object.values(rows).filter((r) => r.on).length;

  return (
    <div className="space-y-3 border-t border-line-soft pt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{t('couriers.coverageMap')}</h3>
        <span className="text-xs text-muted">{t('couriers.govCount', { count: activeCount })}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto border border-line rounded p-2">
        {GOVERNORATES.map((g) => {
          const r = rows[g.code] ?? { on: false, eta: 2 };
          return (
            <div key={g.code} className={`flex items-center gap-2 rounded px-2 py-1.5 border ${r.on ? 'border-accent/40 bg-accent/10' : 'border-line'}`}>
              <label className="flex items-center gap-1.5 text-xs flex-1 cursor-pointer">
                <input type="checkbox" checked={r.on} onChange={(e) => set(g.code, { on: e.target.checked })} />
                {locale === 'ar' ? g.nameAr : g.nameEn}
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={r.eta}
                disabled={!r.on}
                onChange={(e) => set(g.code, { eta: Number(e.target.value) })}
                className="w-12 rounded border border-line px-1 py-0.5 text-xs disabled:bg-surface-muted"
                title={t('couriers.etaDays')}
              />
            </div>
          );
        })}
      </div>
      <Button disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? t('common.pleaseWait') : t('couriers.saveCoverage')}</Button>
    </div>
  );
}
