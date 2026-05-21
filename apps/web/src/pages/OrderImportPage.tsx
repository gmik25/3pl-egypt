import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';

import { listClients } from '../api/clients';
import { importOrdersCsv } from '../api/orders';
import type { CsvImportResult } from '../types';
import { Card, Select, Spinner, Alert, Badge } from '../components/ui';

const CSV_HEADERS =
  'external_ref, customer_name, customer_phone, customer_phone_alt, governorate, apartment, floor, building, street, district, payment_method, cod_amount_egp, sku_code, sku_name_ar, quantity, unit_price_egp, notes';

export default function OrderImportPage() {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [clientId, setClientId] = useState('');
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });

  const importer = useMutation({
    mutationFn: (file: File) => importOrdersCsv(clientId, file),
    onSuccess: (r) => {
      setResult(r);
      if (fileRef.current) fileRef.current.value = '';
    },
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link to="/orders" className="text-sm text-brand-600 hover:underline">← {t('orders.title')}</Link>
        <h1 className="text-2xl font-bold mt-1">{t('orders.importTitle')}</h1>
      </div>

      <Card className="p-6 space-y-4">
        <Select label={t('orders.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">{t('orders.selectClient')}</option>
          {clients.data?.items.map((c) => (
            <option key={c.id} value={c.id}>{c.legalName}</option>
          ))}
        </Select>

        <div>
          <span className="block text-sm font-medium text-slate-700 mb-1">{t('orders.csvFile')}</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            disabled={!clientId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importer.mutate(f);
            }}
            className="text-sm"
          />
          {!clientId && <p className="text-xs text-amber-600 mt-1">{t('orders.selectClientFirst')}</p>}
        </div>

        <div className="text-xs text-slate-500">
          <p className="mb-1">{t('orders.csvHeadersLabel')}:</p>
          <code className="block bg-slate-100 p-2 rounded break-all" dir="ltr">{CSV_HEADERS}</code>
        </div>

        {importer.isPending && <Spinner />}
        {importer.isError && <Alert>{t('orders.importError')}</Alert>}
      </Card>

      {result && (
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Badge tone="green">{t('orders.created', { count: result.created })}</Badge>
            {result.failed.length > 0 && <Badge tone="red">{t('orders.failedRows', { count: result.failed.length })}</Badge>}
          </div>
          {result.failed.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-start font-medium px-2 py-1">{t('orders.row')}</th>
                  <th className="text-start font-medium px-2 py-1">{t('orders.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {result.failed.map((f) => (
                  <tr key={f.row} className="border-b border-slate-100">
                    <td className="px-2 py-1">{f.row}</td>
                    <td className="px-2 py-1 text-red-600">{f.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
