import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listHsCodes, upsertHsCode } from '../../api/customs';
import { Button, Card, TextField, Spinner } from '../../components/ui';

export default function HsCodesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [dutyPct, setDutyPct] = useState('');

  const hsCodes = useQuery({ queryKey: ['hs-codes', search], queryFn: () => listHsCodes(search || undefined) });

  const upsert = useMutation({
    mutationFn: () => upsertHsCode({ code: code.trim(), description: description.trim(), dutyRateBps: Math.round(parseFloat(dutyPct || '0') * 100) }),
    onSuccess: () => { setCode(''); setDescription(''); setDutyPct(''); void qc.invalidateQueries({ queryKey: ['hs-codes'] }); },
  });

  const submit = (e: FormEvent) => { e.preventDefault(); upsert.mutate(); };

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">{t('customs.hsTitle')}</h1>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('customs.hsUpsert')}</h2>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <TextField label={t('customs.hsCode')} required value={code} onChange={(e) => setCode(e.target.value)} placeholder="6109.10" />
          <TextField label={t('customs.hsDescription')} required value={description} onChange={(e) => setDescription(e.target.value)} className="sm:col-span-2" />
          <TextField label={t('customs.dutyRatePct')} inputMode="decimal" required value={dutyPct} onChange={(e) => setDutyPct(e.target.value)} />
          <Button type="submit" disabled={upsert.isPending}>{t('common.save')}</Button>
        </form>
      </Card>

      <Card className="p-4">
        <TextField label={t('customs.search')} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="6109 / cotton" />
      </Card>

      <Card>
        {hsCodes.isLoading ? <Spinner /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted border-b border-line">
                <th className="text-start font-medium px-4 py-3">{t('customs.hsCode')}</th>
                <th className="text-start font-medium px-4 py-3">{t('customs.hsDescription')}</th>
                <th className="text-end font-medium px-4 py-3">{t('customs.duty')}</th>
              </tr>
            </thead>
            <tbody>
              {hsCodes.data?.map((h) => (
                <tr key={h.id} className="border-b border-line-soft">
                  <td className="px-4 py-3 font-medium" dir="ltr">{h.code}</td>
                  <td className="px-4 py-3 text-body">{h.description}</td>
                  <td className="px-4 py-3 text-end">{(h.dutyRateBps / 100).toFixed(2)}%</td>
                </tr>
              ))}
              {hsCodes.data?.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-faint">{t('common.noResults')}</td></tr>}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
