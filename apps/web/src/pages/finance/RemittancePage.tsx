import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatEgp } from '@3pl/shared';

import {
  codByDriver,
  confirmRemittance,
  createRemittance,
  eligibleCodOrders,
  listRemittances,
  rejectRemittance,
} from '../../api/finance';
import type { RemittanceStatus } from '../../types';
import { useAuthStore } from '../../stores/auth.store';
import { Button, Card, Spinner, Badge, Alert } from '../../components/ui';
import { currentLocale } from '../../i18n';

const STATUS_TONE: Record<RemittanceStatus, 'amber' | 'green' | 'red'> = { PENDING: 'amber', CONFIRMED: 'green', REJECTED: 'red' };

export default function RemittancePage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const qc = useQueryClient();
  const canSubmit = useAuthStore((s) => s.hasPermission('remittance.submit'));
  const canConfirm = useAuthStore((s) => s.hasPermission('finance.write'));

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const eligible = useQuery({ queryKey: ['eligible-cod'], queryFn: eligibleCodOrders });
  const remittances = useQuery({ queryKey: ['remittances'], queryFn: () => listRemittances() });
  const byDriver = useQuery({ queryKey: ['cod-by-driver'], queryFn: () => codByDriver() });

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const declared = useMemo(
    () => (eligible.data ?? []).filter((o) => selected[o.id]).reduce((s, o) => s + (o.codAmountPiastres ?? 0), 0),
    [eligible.data, selected],
  );

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['eligible-cod'] });
    void qc.invalidateQueries({ queryKey: ['remittances'] });
  };

  const submit = useMutation({
    mutationFn: () => createRemittance({ orderIds: selectedIds, declaredAmountPiastres: declared }),
    onSuccess: () => { setSelected({}); setError(null); refresh(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? t('remittance.submitError')),
  });
  const confirm = useMutation({ mutationFn: (id: string) => confirmRemittance(id), onSuccess: refresh });
  const reject = useMutation({ mutationFn: (id: string) => rejectRemittance(id), onSuccess: refresh });

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">{t('remittance.title')}</h1>

      {canSubmit && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">{t('remittance.submitTitle')}</h2>
          {eligible.isLoading ? <Spinner /> : eligible.data && eligible.data.length > 0 ? (
            <>
              <div className="max-h-64 overflow-y-auto border border-line rounded">
                <table className="w-full text-sm">
                  <tbody>
                    {eligible.data.map((o) => (
                      <tr key={o.id} className="border-b border-line-soft">
                        <td className="px-3 py-2"><input type="checkbox" checked={!!selected[o.id]} onChange={(e) => setSelected((m) => ({ ...m, [o.id]: e.target.checked }))} /></td>
                        <td className="px-3 py-2 font-medium" dir="ltr">{o.reference}</td>
                        <td className="px-3 py-2 text-body">{o.client.legalName}</td>
                        <td className="px-3 py-2 text-end">{formatEgp(o.codAmountPiastres ?? 0, { locale: egpLoc })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-body">{t('remittance.declared')}: <strong>{formatEgp(declared, { locale: egpLoc })}</strong> ({selectedIds.length})</span>
                <Button disabled={selectedIds.length === 0 || submit.isPending} onClick={() => submit.mutate()}>{t('remittance.submit')}</Button>
              </div>
              {error && <Alert>{error}</Alert>}
            </>
          ) : <p className="text-sm text-faint">{t('remittance.noEligible')}</p>}
        </Card>
      )}

      <Card>
        <div className="px-6 pt-5 pb-2"><h2 className="text-lg font-semibold">{t('remittance.queue')}</h2></div>
        {remittances.isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('remittance.reference')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('remittance.driver')}</th>
                  <th className="text-end font-medium px-4 py-3">{t('remittance.declared')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.state')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {remittances.data?.map((r) => (
                  <tr key={r.id} className="border-b border-line-soft">
                    <td className="px-4 py-3 font-medium" dir="ltr">{r.reference}<span className="block text-xs text-faint">{r._count?.items ?? 0} {t('remittance.orders')}</span></td>
                    <td className="px-4 py-3">{r.driver?.fullName}</td>
                    <td className="px-4 py-3 text-end">{formatEgp(r.declaredAmountPiastres, { locale: egpLoc })}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[r.status]}>{t(`remittance.statuses.${r.status}`)}</Badge></td>
                    <td className="px-4 py-3 text-end">
                      {r.status === 'PENDING' && canConfirm && (
                        <div className="flex gap-2 justify-end">
                          <Button variant="secondary" disabled={confirm.isPending} onClick={() => confirm.mutate(r.id)}>{t('remittance.confirm')}</Button>
                          <Button variant="danger" disabled={reject.isPending} onClick={() => reject.mutate(r.id)}>{t('remittance.reject')}</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {remittances.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-faint">{t('common.noResults')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('remittance.codByDriver')}</h2>
        {byDriver.isLoading ? <Spinner /> : byDriver.data && byDriver.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="text-muted border-b border-line"><th className="text-start font-medium px-2 py-2">{t('remittance.driver')}</th><th className="text-start font-medium px-2 py-2">{t('remittance.day')}</th><th className="text-end font-medium px-2 py-2">{t('remittance.orders')}</th><th className="text-end font-medium px-2 py-2">COD</th></tr></thead>
            <tbody>
              {byDriver.data.map((r, i) => (
                <tr key={i} className="border-b border-line-soft">
                  <td className="px-2 py-2">{r.driverName}</td>
                  <td className="px-2 py-2 text-body">{r.day}</td>
                  <td className="px-2 py-2 text-end">{r.count}</td>
                  <td className="px-2 py-2 text-end">{formatEgp(r.totalPiastres, { locale: egpLoc })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-faint">{t('common.noResults')}</p>}
      </Card>
    </div>
  );
}
