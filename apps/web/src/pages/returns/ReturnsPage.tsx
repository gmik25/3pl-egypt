import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatEgp } from '@3pl/shared';

import {
  approveReturn,
  closeReturn,
  disposeReturnItem,
  getReturn,
  inspectReturnItem,
  listReturns,
  markReturnInspected,
  receiveReturn,
  rejectReturn,
} from '../../api/returns';
import { listLocations } from '../../api/wms';
import type { ReturnDisposition, ReturnStatus } from '../../types';
import { Button, Card, Select, Spinner, Badge, Alert } from '../../components/ui';
import { currentLocale } from '../../i18n';

const STATUSES: ReturnStatus[] = ['REQUESTED', 'APPROVED', 'RECEIVED', 'INSPECTED', 'CLOSED', 'REJECTED'];
const STATUS_TONE: Record<ReturnStatus, 'amber' | 'blue' | 'green' | 'red' | 'slate'> = {
  REQUESTED: 'amber', APPROVED: 'blue', RECEIVED: 'blue', INSPECTED: 'blue', CLOSED: 'green', REJECTED: 'red',
};

export default function ReturnsPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ReturnStatus | ''>('');
  const [selected, setSelected] = useState<string | null>(null);

  const returns = useQuery({ queryKey: ['returns', status], queryFn: () => listReturns(status || undefined) });

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">{t('returns.title')}</h1>

      <Card className="p-4">
        <div className="w-64">
          <Select label={t('orders.state')} value={status} onChange={(e) => setStatus(e.target.value as ReturnStatus | '')}>
            <option value="">{t('common.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`returns.statuses.${s}`)}</option>)}
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-3">
          {returns.isLoading ? <Spinner /> : (
            <ul className="space-y-1">
              {returns.data?.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setSelected(r.id)} className={`w-full text-start px-3 py-2 rounded-md text-sm transition ${selected === r.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-100'}`}>
                    <span className="font-medium" dir="ltr">{r.rmaNumber}</span>
                    <span className="block text-xs text-slate-400">{r.order?.reference} · {r.client?.legalName}</span>
                    <Badge tone={STATUS_TONE[r.status]}>{t(`returns.statuses.${r.status}`)}</Badge>
                  </button>
                </li>
              ))}
              {returns.data?.length === 0 && <li className="text-sm text-slate-400 px-3 py-2">{t('common.noResults')}</li>}
            </ul>
          )}
        </Card>

        <div className="lg:col-span-2">
          {selected ? <ReturnDetailPanel id={selected} /> : <Card className="p-8 text-center text-slate-400 text-sm">{t('returns.selectPrompt')}</Card>}
        </div>
      </div>
    </div>
  );
}

function ReturnDetailPanel({ id }: { id: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const ret = useQuery({ queryKey: ['return', id], queryFn: () => getReturn(id) });
  const locations = useQuery({
    queryKey: ['locations', ret.data?.order?.warehouseId],
    queryFn: () => listLocations(ret.data!.order!.warehouseId),
    enabled: !!ret.data?.order?.warehouseId,
  });

  const refresh = () => { void qc.invalidateQueries({ queryKey: ['return', id] }); void qc.invalidateQueries({ queryKey: ['returns'] }); };
  const onSuccess = () => { setError(null); refresh(); };
  const onError = (e: any) => setError(e?.response?.data?.message ?? t('returns.actionError'));

  const approve = useMutation({ mutationFn: () => approveReturn(id), onSuccess, onError });
  const reject = useMutation({ mutationFn: () => rejectReturn(id), onSuccess, onError });
  const receive = useMutation({ mutationFn: () => receiveReturn(id), onSuccess, onError });
  const inspected = useMutation({ mutationFn: () => markReturnInspected(id), onSuccess, onError });
  const close = useMutation({ mutationFn: () => closeReturn(id), onSuccess, onError });
  const dispose = useMutation({ mutationFn: (itemId: string) => disposeReturnItem(itemId), onSuccess, onError });
  const inspect = useMutation({
    mutationFn: (v: { itemId: string; disposition: ReturnDisposition; locationId: string }) => inspectReturnItem(v.itemId, v.disposition, v.locationId),
    onSuccess,
    onError,
  });

  if (ret.isLoading || !ret.data) return <Spinner />;
  const r = ret.data;
  const allInspected = r.items.every((i) => i.disposition);

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" dir="ltr">{r.rmaNumber}</h2>
          <Badge tone={STATUS_TONE[r.status]}>{t(`returns.statuses.${r.status}`)}</Badge>
        </div>
        <p className="text-sm text-slate-500 mt-1">{r.order?.reference} · {r.order?.customerName} · {t(`returns.reasons.${r.reason}`)}</p>
        {r.customerNote && <p className="text-sm text-slate-600 mt-2">"{r.customerNote}"</p>}
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}

        <div className="flex gap-2 mt-4 flex-wrap">
          {r.status === 'REQUESTED' && <><Button onClick={() => approve.mutate()} disabled={approve.isPending}>{t('returns.approve')}</Button><Button variant="danger" onClick={() => reject.mutate()} disabled={reject.isPending}>{t('returns.reject')}</Button></>}
          {r.status === 'APPROVED' && <Button onClick={() => receive.mutate()} disabled={receive.isPending}>{t('returns.markReceived')}</Button>}
          {r.status === 'RECEIVED' && <Button onClick={() => inspected.mutate()} disabled={!allInspected || inspected.isPending}>{t('returns.markInspected')}</Button>}
          {r.status === 'INSPECTED' && <Button onClick={() => close.mutate()} disabled={close.isPending}>{t('returns.close')}</Button>}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-md font-semibold mb-3">{t('returns.items')}</h3>
        <div className="space-y-3">
          {r.items.map((it) => (
            <div key={it.id} className="border border-slate-200 rounded-md p-3">
              <div className="flex items-center justify-between text-sm">
                <span><span className="font-medium" dir="ltr">{it.sku?.code}</span> · {it.sku?.nameAr} ×{it.quantity}</span>
                {it.disposition ? <Badge tone={it.disposition === 'RESELLABLE' ? 'green' : 'red'}>{t(`returns.dispositions.${it.disposition}`)}</Badge> : <Badge tone="amber">{t('returns.pendingInspection')}</Badge>}
              </div>
              {/* Inspect controls (when RECEIVED + not yet dispositioned) */}
              {r.status === 'RECEIVED' && !it.disposition && (
                <div className="flex gap-2 items-end mt-2">
                  <div className="w-44">
                    <Select label={t('inventory.location')} id={`loc-${it.id}`} defaultValue="">
                      <option value="">—</option>
                      {locations.data?.map((l) => <option key={l.id} value={l.id}>{l.code}</option>)}
                    </Select>
                  </div>
                  <Button variant="secondary" onClick={() => { const loc = (document.getElementById(`loc-${it.id}`) as HTMLSelectElement)?.value; if (loc) inspect.mutate({ itemId: it.id, disposition: 'RESELLABLE', locationId: loc }); }}>{t('returns.resellable')}</Button>
                  <Button variant="danger" onClick={() => { const loc = (document.getElementById(`loc-${it.id}`) as HTMLSelectElement)?.value; if (loc) inspect.mutate({ itemId: it.id, disposition: 'DAMAGED', locationId: loc }); }}>{t('returns.damaged')}</Button>
                </div>
              )}
              {/* Disposal for damaged items */}
              {it.disposition === 'DAMAGED' && (
                it.disposalApproved
                  ? <p className="text-xs text-slate-400 mt-2">{t('returns.disposed')}</p>
                  : <Button variant="ghost" className="mt-2" onClick={() => dispose.mutate(it.id)} disabled={dispose.isPending}>{t('returns.approveDisposal')}</Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {r.creditNote && (
        <Card className="p-6">
          <h3 className="text-md font-semibold mb-2">{t('returns.creditNote')} <span dir="ltr" className="text-slate-400">{r.creditNote.reference}</span></h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">{t('quote.net')}</span><span>{formatEgp(r.creditNote.netPiastres, { locale: egpLoc })}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">{t('quote.vat', { pct: 14 })}</span><span>{formatEgp(r.creditNote.vatPiastres, { locale: egpLoc })}</span></div>
            <div className="flex justify-between font-semibold border-t border-slate-200 pt-1"><span>{t('quote.gross')}</span><span>{formatEgp(r.creditNote.grossPiastres, { locale: egpLoc })}</span></div>
          </div>
        </Card>
      )}
    </div>
  );
}
