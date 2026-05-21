import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  GOVERNORATES,
  PAYMENT_METHODS,
  egpToPiastres,
  type GovernorateCode,
  type PaymentMethod,
} from '@3pl/shared';

import { listClients } from '../api/clients';
import { createOrder, type CreateOrderInput } from '../api/orders';
import { Button, Card, Select, TextField, Alert } from '../components/ui';
import { currentLocale } from '../i18n';

interface ItemRow {
  skuCode: string;
  nameAr: string;
  quantity: string;
  unitPriceEgp: string;
}

const EMPTY_ITEM: ItemRow = { skuCode: '', nameAr: '', quantity: '1', unitPriceEgp: '0.00' };

export default function OrderCreatePage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const navigate = useNavigate();

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });

  const [clientId, setClientId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [governorate, setGovernorate] = useState<GovernorateCode>('C');
  const [street, setStreet] = useState('');
  const [building, setBuilding] = useState('');
  const [district, setDistrict] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [codEgp, setCodEgp] = useState('0.00');
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (input: CreateOrderInput) => createOrder(input),
    onSuccess: (o) => navigate(`/orders/${o.id}`, { replace: true }),
    onError: (e) => {
      const ax = e as AxiosError<{ message?: string | string[] }>;
      const m = ax.response?.data?.message;
      setError(Array.isArray(m) ? m.join(', ') : (m ?? t('orders.saveError')));
    },
  });

  const setItem = (idx: number, patch: Partial<ItemRow>) =>
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!clientId) { setError(t('orders.selectClient')); return; }
    create.mutate({
      clientId,
      customerName,
      customerPhone,
      governorate,
      addressStreet: street || undefined,
      addressBuilding: building || undefined,
      addressDistrict: district || undefined,
      paymentMethod,
      codAmountPiastres: paymentMethod === 'COD' ? egpToPiastres(codEgp) : undefined,
      items: items
        .filter((i) => i.skuCode.trim())
        .map((i) => ({
          skuCode: i.skuCode.trim(),
          nameAr: i.nameAr || undefined,
          quantity: Number(i.quantity) || 1,
          unitPricePiastres: egpToPiastres(i.unitPriceEgp),
        })),
    });
  };

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">{t('orders.createTitle')}</h1>
      {error && <Alert>{error}</Alert>}

      <form onSubmit={submit} className="space-y-5">
        <Card className="p-6 space-y-4">
          <Select label={t('orders.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">{t('orders.selectClient')}</option>
            {clients.data?.items.map((c) => (
              <option key={c.id} value={c.id}>{c.legalName}</option>
            ))}
          </Select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField label={t('orders.customerName')} required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <TextField label={t('orders.phone')} required value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+201001234567" />
            <Select label={t('clients.governorate')} value={governorate} onChange={(e) => setGovernorate(e.target.value as GovernorateCode)}>
              {GOVERNORATES.map((g) => (
                <option key={g.code} value={g.code}>{locale === 'ar' ? g.nameAr : g.nameEn}</option>
              ))}
            </Select>
            <TextField label={t('clients.street')} value={street} onChange={(e) => setStreet(e.target.value)} />
            <TextField label={t('clients.building')} value={building} onChange={(e) => setBuilding(e.target.value)} />
            <TextField label={t('clients.district')} value={district} onChange={(e) => setDistrict(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label={t('orders.payment')} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {PAYMENT_METHODS.map((p) => (
                <option key={p} value={p}>{t(`orders.payments.${p}`)}</option>
              ))}
            </Select>
            {paymentMethod === 'COD' && (
              <TextField label={t('orders.codAmountEgp')} inputMode="decimal" value={codEgp} onChange={(e) => setCodEgp(e.target.value)} />
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('orders.items')}</h2>
            <Button type="button" variant="secondary" onClick={() => setItems((r) => [...r, { ...EMPTY_ITEM }])}>
              {t('orders.addItem')}
            </Button>
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end border-b border-slate-100 pb-3">
              <TextField label="SKU" value={it.skuCode} onChange={(e) => setItem(idx, { skuCode: e.target.value })} />
              <TextField label={t('orders.itemName')} value={it.nameAr} onChange={(e) => setItem(idx, { nameAr: e.target.value })} />
              <TextField label={t('orders.qty')} inputMode="numeric" value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} />
              <TextField label={t('orders.unitPriceEgp')} inputMode="decimal" value={it.unitPriceEgp} onChange={(e) => setItem(idx, { unitPriceEgp: e.target.value })} />
              {items.length > 1 && (
                <Button type="button" variant="ghost" onClick={() => setItems((r) => r.filter((_, i) => i !== idx))}>
                  {t('common.remove')}
                </Button>
              )}
            </div>
          ))}
        </Card>

        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? t('common.pleaseWait') : t('orders.create')}
        </Button>
      </form>
    </div>
  );
}
