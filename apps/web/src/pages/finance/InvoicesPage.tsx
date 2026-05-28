import { Inbox } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatEgp } from '@3pl/shared';

import { listClients } from '../../api/clients';
import { generateInvoice, getInvoice, getInvoiceEta, issueInvoice, listInvoices } from '../../api/finance';
import type { Invoice, InvoiceStatus } from '../../types';
import { Button, Card, Select, TextField, Badge, Alert, TableSkeleton, EmptyState } from '../../components/ui';
import { currentLocale } from '../../i18n';

const TONE: Record<InvoiceStatus, 'slate' | 'green' | 'red'> = { DRAFT: 'slate', ISSUED: 'green', CANCELLED: 'red' };

export default function InvoicesPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const qc = useQueryClient();

  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [eta, setEta] = useState<unknown>(null);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const invoices = useQuery({ queryKey: ['invoices'], queryFn: () => listInvoices() });
  const detail = useQuery({ queryKey: ['invoice', openId], queryFn: () => getInvoice(openId!), enabled: !!openId });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['invoices'] });

  const generate = useMutation({
    mutationFn: () => generateInvoice({ clientId, periodStart: new Date(from).toISOString(), periodEnd: new Date(to + 'T23:59:59').toISOString() }),
    onSuccess: (inv: Invoice) => { setError(null); setOpenId(inv.id); refresh(); },
    onError: (e: any) => setError(e?.response?.data?.message ?? t('invoices.generateError')),
  });
  const issue = useMutation({ mutationFn: (id: string) => issueInvoice(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['invoice', openId] }); refresh(); } });

  const submit = (e: FormEvent) => { e.preventDefault(); generate.mutate(); };
  const viewEta = async (id: string) => setEta(await getInvoiceEta(id));

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-2xl font-bold">{t('invoices.title')}</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('invoices.generate')}</h2>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <Select label={t('orders.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t('orders.selectClient')}</option>
            {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
          <TextField label={t('invoices.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label={t('invoices.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button type="submit" disabled={!clientId || generate.isPending}>{t('invoices.generate')}</Button>
        </form>
        {error && <div className="mt-3"><Alert>{error}</Alert></div>}
        <p className="text-xs text-faint mt-3">{t('invoices.etaNote')}</p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          {invoices.isLoading ? <TableSkeleton cols={3} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-muted border-b border-line"><th className="text-start font-medium px-4 py-3">{t('invoices.reference')}</th><th className="text-end font-medium px-4 py-3">{t('quote.gross')}</th><th className="text-start font-medium px-4 py-3">{t('orders.state')}</th></tr></thead>
                <tbody>
                  {invoices.data?.map((inv) => (
                    <tr key={inv.id} className={`border-b border-line-soft cursor-pointer hover:bg-surface-muted ${openId === inv.id ? 'bg-accent/10' : ''}`} onClick={() => { setOpenId(inv.id); setEta(null); }}>
                      <td className="px-4 py-3 font-medium" dir="ltr">{inv.reference}<span className="block text-xs text-faint">{inv.client?.legalName}</span></td>
                      <td className="px-4 py-3 text-end">{formatEgp(inv.grossPiastres, { locale: egpLoc })}</td>
                      <td className="px-4 py-3"><Badge tone={TONE[inv.status]}>{t(`invoices.statuses.${inv.status}`)}</Badge></td>
                    </tr>
                  ))}
                  {invoices.data?.length === 0 && <tr><td colSpan={3}><EmptyState icon={Inbox} title={t('invoices.emptyTitle')} hint={t('invoices.emptyHint')} /></td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {openId && detail.data && (
          <Card className="p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" dir="ltr">{detail.data.reference}</h2>
              <Badge tone={TONE[detail.data.status]}>{t(`invoices.statuses.${detail.data.status}`)}</Badge>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {detail.data.lines?.map((l) => (
                  <tr key={l.id} className="border-b border-line-soft">
                    <td className="px-2 py-2">{l.description}</td>
                    <td className="px-2 py-2 text-end">{formatEgp(l.netPiastres, { locale: egpLoc })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted">{t('quote.net')}</span><span>{formatEgp(detail.data.netPiastres, { locale: egpLoc })}</span></div>
              <div className="flex justify-between"><span className="text-muted">{t('quote.vat', { pct: 14 })}</span><span>{formatEgp(detail.data.vatPiastres, { locale: egpLoc })}</span></div>
              <div className="flex justify-between font-semibold text-base border-t border-line pt-1"><span>{t('quote.gross')}</span><span>{formatEgp(detail.data.grossPiastres, { locale: egpLoc })}</span></div>
            </div>
            {detail.data.etaUuid && <p className="text-xs text-faint">ETA UUID: <code dir="ltr">{detail.data.etaUuid}</code></p>}
            <div className="flex gap-2">
              {detail.data.status === 'DRAFT' && <Button disabled={issue.isPending} onClick={() => issue.mutate(detail.data!.id)}>{t('invoices.issue')}</Button>}
              <Button variant="secondary" onClick={() => viewEta(detail.data!.id)}>{t('invoices.viewEta')}</Button>
            </div>
            {eta != null && <pre className="bg-slate-900 text-slate-100 text-xs p-3 rounded overflow-x-auto" dir="ltr">{JSON.stringify(eta, null, 2)}</pre>}
          </Card>
        )}
      </div>
    </div>
  );
}
