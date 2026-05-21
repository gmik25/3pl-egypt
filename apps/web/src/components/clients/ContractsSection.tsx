import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { egpToPiastres, formatEgp } from '@3pl/shared';

import {
  createContract,
  listContracts,
  quoteContract,
  upsertSla,
  type ContractInput,
  type SlaInput,
} from '../../api/clients';
import type { Contract, Quote } from '../../types';
import { Button, Card, TextField, Spinner, Badge } from '../ui';
import { currentLocale } from '../../i18n';

function egpLocale(): 'ar-EG' | 'en-EG' {
  return currentLocale() === 'ar' ? 'ar-EG' : 'en-EG';
}

export function ContractsSection({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const contracts = useQuery({ queryKey: ['contracts', clientId], queryFn: () => listContracts(clientId) });

  const [showNew, setShowNew] = useState(false);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('contracts.title')}</h2>
        <Button variant="secondary" onClick={() => setShowNew((s) => !s)}>
          {showNew ? t('common.cancel') : t('contracts.add')}
        </Button>
      </div>

      {showNew && (
        <NewContractForm
          clientId={clientId}
          onDone={() => {
            setShowNew(false);
            void qc.invalidateQueries({ queryKey: ['contracts', clientId] });
          }}
        />
      )}

      {contracts.isLoading ? (
        <Spinner />
      ) : contracts.data && contracts.data.length > 0 ? (
        <div className="space-y-3">
          {contracts.data.map((c) => (
            <ContractCard key={c.id} contract={c} clientId={clientId} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">{t('contracts.none')}</p>
      )}
    </Card>
  );
}

function NewContractForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [startsOn, setStartsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [storage, setStorage] = useState('5.00');
  const [pickPack, setPickPack] = useState('15.00');
  const [codBps, setCodBps] = useState('2.50');
  const [returnFee, setReturnFee] = useState('20.00');

  const create = useMutation({
    mutationFn: (input: ContractInput) => createContract(clientId, input),
    onSuccess: onDone,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({
      startsOn: new Date(startsOn).toISOString(),
      storagePerSkuPerDayPiastres: egpToPiastres(storage),
      pickAndPackPiastres: egpToPiastres(pickPack),
      // EG: COD commission entered as a percentage, stored as basis points.
      codCommissionBps: Math.round(parseFloat(codBps) * 100),
      returnFeePiastres: egpToPiastres(returnFee),
    });
  };

  return (
    <form onSubmit={submit} className="border border-slate-200 rounded-md p-4 space-y-3 bg-slate-50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TextField label={t('contracts.startsOn')} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        <TextField label={t('contracts.storageEgp')} inputMode="decimal" value={storage} onChange={(e) => setStorage(e.target.value)} />
        <TextField label={t('contracts.pickPackEgp')} inputMode="decimal" value={pickPack} onChange={(e) => setPickPack(e.target.value)} />
        <TextField label={t('contracts.codCommissionPct')} inputMode="decimal" value={codBps} onChange={(e) => setCodBps(e.target.value)} />
        <TextField label={t('contracts.returnFeeEgp')} inputMode="decimal" value={returnFee} onChange={(e) => setReturnFee(e.target.value)} />
      </div>
      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? t('common.pleaseWait') : t('contracts.create')}
      </Button>
    </form>
  );
}

function ContractCard({ contract, clientId }: { contract: Contract; clientId: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'sla' | 'quote' | null>(null);

  return (
    <div className="border border-slate-200 rounded-md p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm">
          <span className="font-medium">{new Date(contract.startsOn).toLocaleDateString()}</span>
          {contract.endsOn && <span className="text-slate-400"> → {new Date(contract.endsOn).toLocaleDateString()}</span>}
          {contract.isActive ? (
            <Badge tone="green">{t('contracts.activeBadge')}</Badge>
          ) : (
            <Badge tone="slate">{t('contracts.inactiveBadge')}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setTab(tab === 'sla' ? null : 'sla')}>
            {t('contracts.sla')}
          </Button>
          <Button variant="ghost" onClick={() => setTab(tab === 'quote' ? null : 'quote')}>
            {t('contracts.quote')}
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
        <PriceItem label={t('contracts.storageEgp')} piastres={contract.storagePerSkuPerDayPiastres} />
        <PriceItem label={t('contracts.pickPackEgp')} piastres={contract.pickAndPackPiastres} />
        <div>
          <dt className="text-slate-500">{t('contracts.codCommissionPct')}</dt>
          <dd className="font-medium">{(contract.codCommissionBps / 100).toFixed(2)}%</dd>
        </div>
        <PriceItem label={t('contracts.returnFeeEgp')} piastres={contract.returnFeePiastres} />
      </dl>

      {tab === 'sla' && <SlaEditor contract={contract} clientId={clientId} />}
      {tab === 'quote' && <QuoteCalculator contractId={contract.id} />}
    </div>
  );
}

function PriceItem({ label, piastres }: { label: string; piastres: number }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium">{formatEgp(piastres, { locale: egpLocale() })}</dd>
    </div>
  );
}

function SlaEditor({ contract, clientId }: { contract: Contract; clientId: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [handling, setHandling] = useState(String(contract.sla?.handlingTimeMinutes ?? 240));
  const [cairo, setCairo] = useState(String(contract.sla?.deliveryWindowDaysCairo ?? 2));
  const [other, setOther] = useState(String(contract.sla?.deliveryWindowDaysOther ?? 4));
  const [returnRate, setReturnRate] = useState(String((contract.sla?.maxReturnRateBps ?? 500) / 100));

  const save = useMutation({
    mutationFn: (input: SlaInput) => upsertSla(contract.id, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['contracts', clientId] }),
  });

  return (
    <div className="bg-slate-50 rounded-md p-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TextField label={t('sla.handlingMinutes')} inputMode="numeric" value={handling} onChange={(e) => setHandling(e.target.value)} />
        <TextField label={t('sla.cairoDays')} inputMode="numeric" value={cairo} onChange={(e) => setCairo(e.target.value)} />
        <TextField label={t('sla.otherDays')} inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value)} />
        <TextField label={t('sla.maxReturnPct')} inputMode="decimal" value={returnRate} onChange={(e) => setReturnRate(e.target.value)} />
      </div>
      <Button
        disabled={save.isPending}
        onClick={() =>
          save.mutate({
            handlingTimeMinutes: Number(handling),
            deliveryWindowDaysCairo: Number(cairo),
            deliveryWindowDaysOther: Number(other),
            maxReturnRateBps: Math.round(parseFloat(returnRate) * 100),
          })
        }
      >
        {save.isPending ? t('common.pleaseWait') : t('sla.save')}
      </Button>
      {save.isSuccess && <span className="text-sm text-green-600 ms-2">{t('common.saved')}</span>}
    </div>
  );
}

function QuoteCalculator({ contractId }: { contractId: string }) {
  const { t } = useTranslation();
  const [skuCount, setSkuCount] = useState('10');
  const [storageDays, setStorageDays] = useState('30');
  const [orderCount, setOrderCount] = useState('100');
  const [codEgp, setCodEgp] = useState('5000.00');
  const [returnCount, setReturnCount] = useState('5');
  const [quote, setQuote] = useState<Quote | null>(null);

  const run = useMutation({
    mutationFn: () =>
      quoteContract(contractId, {
        skuCount: Number(skuCount),
        storageDays: Number(storageDays),
        orderCount: Number(orderCount),
        codAmountPiastres: egpToPiastres(codEgp),
        returnCount: Number(returnCount),
      }),
    onSuccess: setQuote,
  });

  return (
    <div className="bg-slate-50 rounded-md p-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <TextField label={t('quote.skuCount')} inputMode="numeric" value={skuCount} onChange={(e) => setSkuCount(e.target.value)} />
        <TextField label={t('quote.storageDays')} inputMode="numeric" value={storageDays} onChange={(e) => setStorageDays(e.target.value)} />
        <TextField label={t('quote.orderCount')} inputMode="numeric" value={orderCount} onChange={(e) => setOrderCount(e.target.value)} />
        <TextField label={t('quote.codEgp')} inputMode="decimal" value={codEgp} onChange={(e) => setCodEgp(e.target.value)} />
        <TextField label={t('quote.returnCount')} inputMode="numeric" value={returnCount} onChange={(e) => setReturnCount(e.target.value)} />
      </div>
      <Button onClick={() => run.mutate()} disabled={run.isPending}>
        {run.isPending ? t('common.pleaseWait') : t('quote.calculate')}
      </Button>

      {quote && (
        <div className="text-sm border-t border-slate-200 pt-3 space-y-1">
          {quote.lines.map((l) => (
            <div key={l.key} className="flex justify-between">
              <span className="text-slate-500">{t(`quote.lines.${l.key}`)}</span>
              <span>{formatEgp(l.amountPiastres, { locale: egpLocale() })}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-slate-200 pt-1 mt-1">
            <span className="text-slate-500">{t('quote.net')}</span>
            <span>{formatEgp(quote.netPiastres, { locale: egpLocale() })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{t('quote.vat', { pct: (quote.vatRateBps / 100).toFixed(0) })}</span>
            <span>{formatEgp(quote.vatPiastres, { locale: egpLocale() })}</span>
          </div>
          <div className="flex justify-between font-semibold text-base">
            <span>{t('quote.gross')}</span>
            <span>{formatEgp(quote.grossPiastres, { locale: egpLocale() })}</span>
          </div>
        </div>
      )}
    </div>
  );
}
