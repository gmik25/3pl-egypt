import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listClients } from '../../api/clients';
import { connectStore, disconnectStore, listStores } from '../../api/integrations';
import type { ConnectStoreResult, StoreConnectionStatus, StorePlatform } from '../../types';
import { Button, Card, Select, TextField, Spinner, Badge, Alert } from '../../components/ui';

const PLATFORMS: StorePlatform[] = ['SHOPIFY', 'SALLA', 'ZID', 'WOOCOMMERCE'];

const STATUS_TONE: Record<StoreConnectionStatus, 'green' | 'amber' | 'red'> = {
  CONNECTED: 'green',
  PENDING: 'amber',
  REVOKED: 'red',
};

export default function StoresPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [showNew, setShowNew] = useState(false);

  const stores = useQuery({ queryKey: ['stores'], queryFn: listStores });

  // Banner after the OAuth round-trip lands back on /integrations/stores?connected=…
  const connected = params.get('connected');
  const oauthError = params.get('error');
  useEffect(() => {
    if (connected || oauthError) void qc.invalidateQueries({ queryKey: ['stores'] });
  }, [connected, oauthError, qc]);

  const disconnect = useMutation({
    mutationFn: (id: string) => disconnectStore(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['stores'] }),
  });

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('stores.title')}</h1>
          <p className="text-sm text-slate-500">{t('stores.subtitle')}</p>
        </div>
        <Button onClick={() => setShowNew((o) => !o)}>{showNew ? t('common.cancel') : t('stores.connect')}</Button>
      </div>

      {connected && (
        <Alert tone="green">
          {t('stores.connectedBanner', { platform: connected })}
          {params.get('simulated') && <span className="ms-1">{t('stores.simulatedNote')}</span>}
        </Alert>
      )}
      {oauthError && <Alert tone="red">{t('stores.oauthError', { reason: oauthError })}</Alert>}

      {showNew && (
        <ConnectForm
          onConnected={() => {
            void qc.invalidateQueries({ queryKey: ['stores'] });
          }}
          onClose={() => {
            setShowNew(false);
            setParams({}, { replace: true });
          }}
        />
      )}

      <Card>
        {stores.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="text-start font-medium px-4 py-3">{t('stores.store')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('stores.platform')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('stores.client')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('stores.lastEvent')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('stores.statusLabel')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {stores.data?.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium" dir="ltr">{s.shopDomain}</td>
                    <td className="px-4 py-3">{t(`stores.platforms.${s.platform}`)}</td>
                    <td className="px-4 py-3 text-slate-600">{s.client?.legalName ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{s.lastEventAt ? new Date(s.lastEventAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[s.status]}>{t(`stores.statuses.${s.status}`)}</Badge></td>
                    <td className="px-4 py-3 text-end">
                      {s.status !== 'REVOKED' && (
                        <Button variant="danger" disabled={disconnect.isPending} onClick={() => disconnect.mutate(s.id)}>
                          {t('stores.disconnect')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {stores.data?.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{t('common.noResults')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ConnectForm({ onConnected, onClose }: { onConnected: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [clientId, setClientId] = useState('');
  const [platform, setPlatform] = useState<StorePlatform>('SHOPIFY');
  const [shopDomain, setShopDomain] = useState('');
  const [result, setResult] = useState<ConnectStoreResult | null>(null);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ isActive: true, pageSize: 100 }) });

  const connect = useMutation({
    mutationFn: () => connectStore({ clientId, platform, shopDomain: shopDomain.trim() }),
    onSuccess: (r) => {
      setResult(r);
      onConnected();
    },
  });

  if (result) {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('stores.authorizeTitle')}</h2>
        {result.simulated && <Alert tone="amber">{t('stores.simulatedConnect')}</Alert>}
        <p className="text-sm text-slate-600">{t('stores.authorizeHelp')}</p>
        <a href={result.authorizeUrl} target="_blank" rel="noreferrer">
          <Button>{t('stores.openAuthorize')}</Button>
        </a>
        {result.webhookSecret && (
          <div className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">{t('stores.webhookSecret')}</span>
            <code className="block bg-slate-100 rounded px-3 py-2 text-xs break-all" dir="ltr">{result.webhookSecret}</code>
            <p className="text-xs text-amber-600">{t('stores.secretOnce')}</p>
          </div>
        )}
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select label={t('stores.client')} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">—</option>
          {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
        </Select>
        <Select label={t('stores.platform')} value={platform} onChange={(e) => setPlatform(e.target.value as StorePlatform)}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{t(`stores.platforms.${p}`)}</option>)}
        </Select>
        <TextField label={t('stores.shopDomain')} value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} placeholder="acme.myshopify.com" dir="ltr" />
      </div>
      <p className="text-xs text-slate-500">{t('stores.domainHint')}</p>
      {connect.isError && <Alert>{t('stores.connectError')}</Alert>}
      <Button disabled={!clientId || shopDomain.trim().length < 3 || connect.isPending} onClick={() => connect.mutate()}>
        {connect.isPending ? t('common.pleaseWait') : t('stores.beginOAuth')}
      </Button>
    </Card>
  );
}
