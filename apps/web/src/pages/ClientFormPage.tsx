import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

import { GOVERNORATES, type GovernorateCode } from '@3pl/shared';
import { createClient, getClient, updateClient, type ClientInput } from '../api/clients';
import { Button, Card, TextField, Select, Alert, Spinner, Badge } from '../components/ui';
import { KycSection } from '../components/clients/KycSection';
import { ContractsSection } from '../components/clients/ContractsSection';
import { currentLocale } from '../i18n';

const EMPTY: ClientInput = {
  legalName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  governorate: 'C',
};

export default function ClientFormPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<ClientInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const detail = useQuery({ queryKey: ['client', id], queryFn: () => getClient(id!), enabled: isEdit });

  useEffect(() => {
    if (detail.data) {
      setForm({
        legalName: detail.data.legalName,
        tradingName: detail.data.tradingName ?? undefined,
        taxId: detail.data.taxId ?? undefined,
        commercialRegistration: detail.data.commercialRegistration ?? undefined,
        contactName: detail.data.contactName,
        contactEmail: detail.data.contactEmail,
        contactPhone: detail.data.contactPhone,
        addressApartment: detail.data.addressApartment ?? undefined,
        addressFloor: detail.data.addressFloor ?? undefined,
        addressBuilding: detail.data.addressBuilding ?? undefined,
        addressStreet: detail.data.addressStreet ?? undefined,
        addressDistrict: detail.data.addressDistrict ?? undefined,
        governorate: detail.data.governorate,
      });
    }
  }, [detail.data]);

  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: () => createClient(form),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      navigate(`/clients/${c.id}`, { replace: true });
    },
    onError: (e) => setError(extractError(e, t('clients.saveError'))),
  });

  const update = useMutation({
    mutationFn: () => updateClient(id!, form),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client', id] });
      void qc.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (e) => setError(extractError(e, t('clients.saveError'))),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isEdit) update.mutate();
    else create.mutate();
  };

  if (isEdit && detail.isLoading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isEdit ? t('clients.editTitle') : t('clients.createTitle')}</h1>
        {isEdit && detail.data && (
          <Badge tone={detail.data.isActive ? 'green' : 'red'}>
            {detail.data.isActive ? t('clients.active') : t('clients.inactive')}
          </Badge>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      <Card className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <h2 className="text-lg font-semibold">{t('clients.details')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label={t('clients.legalName')} required value={form.legalName} onChange={(e) => set('legalName', e.target.value)} />
            <TextField label={t('clients.tradingName')} value={form.tradingName ?? ''} onChange={(e) => set('tradingName', e.target.value)} />
            <TextField label={t('clients.taxId')} value={form.taxId ?? ''} onChange={(e) => set('taxId', e.target.value)} />
            <TextField label={t('clients.commercialReg')} value={form.commercialRegistration ?? ''} onChange={(e) => set('commercialRegistration', e.target.value)} />
            <TextField label={t('clients.contactName')} required value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
            <TextField label={t('clients.contactEmail')} type="email" required value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
            <TextField label={t('clients.contactPhone')} required value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="+201001234567" />
            <Select label={t('clients.governorate')} value={form.governorate} onChange={(e) => set('governorate', e.target.value as GovernorateCode)}>
              {GOVERNORATES.map((g) => (
                <option key={g.code} value={g.code}>
                  {locale === 'ar' ? g.nameAr : g.nameEn}
                </option>
              ))}
            </Select>
          </div>

          <h2 className="text-lg font-semibold pt-2">{t('clients.address')}</h2>
          <p className="text-xs text-faint -mt-2">{t('clients.addressHint')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <TextField label={t('clients.apartment')} value={form.addressApartment ?? ''} onChange={(e) => set('addressApartment', e.target.value)} />
            <TextField label={t('clients.floor')} value={form.addressFloor ?? ''} onChange={(e) => set('addressFloor', e.target.value)} />
            <TextField label={t('clients.building')} value={form.addressBuilding ?? ''} onChange={(e) => set('addressBuilding', e.target.value)} />
            <TextField label={t('clients.street')} value={form.addressStreet ?? ''} onChange={(e) => set('addressStreet', e.target.value)} />
            <TextField label={t('clients.district')} value={form.addressDistrict ?? ''} onChange={(e) => set('addressDistrict', e.target.value)} />
          </div>

          <Button type="submit" disabled={create.isPending || update.isPending}>
            {create.isPending || update.isPending ? t('common.pleaseWait') : t('common.save')}
          </Button>
          {update.isSuccess && <span className="text-sm text-green-600 ms-2">{t('common.saved')}</span>}
        </form>
      </Card>

      {isEdit && id && (
        <>
          <KycSection clientId={id} />
          <ContractsSection clientId={id} />
        </>
      )}
    </div>
  );
}

function extractError(e: unknown, fallback: string): string {
  const ax = e as AxiosError<{ message?: string | string[] }>;
  const msg = ax.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
