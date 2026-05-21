import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { egpToPiastres } from '@3pl/shared';

import { listClients } from '../../api/clients';
import { createSku, listSkus, type SkuInput } from '../../api/wms';
import { Button, Card, Select, TextField, Spinner, Badge } from '../../components/ui';
import { currentLocale } from '../../i18n';

const PAGE_SIZE = 25;

export default function SkuCatalogPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const skus = useQuery({
    queryKey: ['skus', { search, clientId, page }],
    queryFn: () => listSkus({ search: search || undefined, clientId: clientId || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const totalPages = skus.data ? Math.max(1, Math.ceil(skus.data.total / skus.data.pageSize)) : 1;

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('catalog.title')}</h1>
        <Button onClick={() => setShowNew((s) => !s)}>{showNew ? t('common.cancel') : t('catalog.create')}</Button>
      </div>

      {showNew && (
        <NewSkuForm
          clients={clients.data?.items ?? []}
          onDone={() => {
            setShowNew(false);
            void qc.invalidateQueries({ queryKey: ['skus'] });
          }}
        />
      )}

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <TextField label={t('catalog.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('catalog.searchPlaceholder')} />
          <Select label={t('orders.client')} value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }}>
            <option value="">{t('common.all')}</option>
            {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        {skus.isLoading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-start font-medium px-4 py-3">SKU</th>
                  <th className="text-start font-medium px-4 py-3">{t('catalog.name')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('catalog.barcode')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('catalog.uom')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('catalog.expiry')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('catalog.reorder')}</th>
                </tr>
              </thead>
              <tbody>
                {skus.data?.items.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium" dir="ltr">{s.code}</td>
                    <td className="px-4 py-3">{locale === 'ar' ? s.nameAr : (s.nameEn ?? s.nameAr)}<span className="block text-xs text-slate-400">{s.client?.legalName}</span></td>
                    <td className="px-4 py-3 text-slate-600" dir="ltr">{s.barcode ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{s.unitOfMeasure}</td>
                    <td className="px-4 py-3">{s.expiryTracked ? <Badge tone="amber">{t('catalog.tracked')}</Badge> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{s.reorderPointQty || '—'}</td>
                  </tr>
                ))}
                {skus.data?.items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('common.noResults')}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {skus.data && skus.data.total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t('common.previous')}</Button>
          <span>{page} / {totalPages}</span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>{t('common.next')}</Button>
        </div>
      )}
    </div>
  );
}

function NewSkuForm({ clients, onDone }: { clients: { id: string; legalName: string }[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ clientId: '', code: '', nameAr: '', nameEn: '', barcode: '', unitOfMeasure: 'EA', expiryTracked: false, reorderPointQty: '0', defaultUnitPriceEgp: '0.00' });
  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: (input: SkuInput) => createSku(input),
    onSuccess: onDone,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({
      clientId: form.clientId,
      code: form.code,
      nameAr: form.nameAr,
      nameEn: form.nameEn || undefined,
      barcode: form.barcode || undefined,
      unitOfMeasure: form.unitOfMeasure,
      expiryTracked: form.expiryTracked,
      reorderPointQty: Number(form.reorderPointQty) || 0,
      defaultUnitPricePiastres: egpToPiastres(form.defaultUnitPriceEgp),
    });
  };

  return (
    <Card className="p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select label={t('orders.client')} required value={form.clientId} onChange={(e) => set('clientId', e.target.value)}>
            <option value="">{t('orders.selectClient')}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
          <TextField label="SKU" required value={form.code} onChange={(e) => set('code', e.target.value)} />
          <TextField label={t('catalog.barcode')} value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="EAN-13" />
          <TextField label={t('catalog.nameAr')} required value={form.nameAr} onChange={(e) => set('nameAr', e.target.value)} />
          <TextField label={t('catalog.nameEn')} value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} />
          <TextField label={t('catalog.uom')} value={form.unitOfMeasure} onChange={(e) => set('unitOfMeasure', e.target.value)} />
          <TextField label={t('catalog.reorder')} inputMode="numeric" value={form.reorderPointQty} onChange={(e) => set('reorderPointQty', e.target.value)} />
          <TextField label={t('catalog.unitPriceEgp')} inputMode="decimal" value={form.defaultUnitPriceEgp} onChange={(e) => set('defaultUnitPriceEgp', e.target.value)} />
          <label className="flex items-end gap-2 text-sm pb-2">
            <input type="checkbox" checked={form.expiryTracked} onChange={(e) => set('expiryTracked', e.target.checked)} />
            {t('catalog.expiryTracked')}
          </label>
        </div>
        <Button type="submit" disabled={create.isPending}>{create.isPending ? t('common.pleaseWait') : t('catalog.create')}</Button>
      </form>
    </Card>
  );
}
