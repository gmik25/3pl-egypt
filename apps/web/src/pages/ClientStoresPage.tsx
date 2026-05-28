import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { connectMyStore, disconnectMyStore, listMyStores } from '../api/portal';
import type { ConnectStoreResult, StoreConnectionStatus, StorePlatform } from '../types';
import { Store } from 'lucide-react';
import { Button, Card, Select, TextField, TableSkeleton, EmptyState, Badge, Alert } from '../components/ui';

const PLATFORMS: StorePlatform[] = ['SHOPIFY', 'SALLA', 'ZID', 'WOOCOMMERCE'];
const STATUS_TONE: Record<StoreConnectionStatus, 'green' | 'amber' | 'red'> = {
  CONNECTED: 'green',
  PENDING: 'amber',
  REVOKED: 'red',
};

export default function ClientStoresPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const stores = useQuery({ queryKey: ['my-stores'], queryFn: listMyStores });

  const disconnect = useMutation({
    mutationFn: (id: string) => disconnectMyStore(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-stores'] }),
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('myStores.title')}</h1>
          <p className="text-sm text-muted">{t('myStores.subtitle')}</p>
        </div>
        <Button onClick={() => setShowNew((o) => !o)}>{showNew ? t('common.cancel') : t('myStores.connect')}</Button>
      </div>

      {showNew && <ConnectForm onConnected={() => void qc.invalidateQueries({ queryKey: ['my-stores'] })} onClose={() => setShowNew(false)} />}

      <Card>
        {stores.isLoading ? (
          <TableSkeleton cols={5} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('myStores.store')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('myStores.platform')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('myStores.lastEvent')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('myStores.statusLabel')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {stores.data?.map((s) => (
                  <tr key={s.id} className="border-b border-line-soft">
                    <td className="px-4 py-3 font-medium" dir="ltr">{s.shopDomain}</td>
                    <td className="px-4 py-3">{t(`myStores.platforms.${s.platform}`)}</td>
                    <td className="px-4 py-3 text-muted">{s.lastEventAt ? new Date(s.lastEventAt).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[s.status]}>{t(`myStores.statuses.${s.status}`)}</Badge></td>
                    <td className="px-4 py-3 text-end">
                      {s.status !== 'REVOKED' && (
                        <Button variant="danger" disabled={disconnect.isPending} onClick={() => disconnect.mutate(s.id)}>{t('myStores.disconnect')}</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {stores.data?.length === 0 && (
                  <tr><td colSpan={5}><EmptyState icon={Store} title={t('myStores.empty')} /></td></tr>
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
  const [platform, setPlatform] = useState<StorePlatform>('SHOPIFY');
  const [shopDomain, setShopDomain] = useState('');
  const [result, setResult] = useState<ConnectStoreResult | null>(null);

  const connect = useMutation({
    mutationFn: () => connectMyStore({ platform, shopDomain: shopDomain.trim() }),
    onSuccess: (r) => {
      setResult(r);
      onConnected();
    },
  });

  if (result) {
    return (
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">{t('myStores.authorizeTitle')}</h2>
        {result.simulated && <Alert tone="amber">{t('myStores.simulatedConnect')}</Alert>}
        <p className="text-sm text-body">{t('myStores.authorizeHelp')}</p>
        {/* In sandbox the real platform has no app to redirect back, so offer the completion shortcut. */}
        <a href={result.sandboxCallbackUrl ?? result.authorizeUrl} target={result.sandboxCallbackUrl ? '_self' : '_blank'} rel="noreferrer">
          <Button>{result.sandboxCallbackUrl ? t('myStores.completeSandbox') : t('myStores.openAuthorize')}</Button>
        </a>
        {result.webhookSecret && (
          <div className="space-y-1">
            <span className="block text-sm font-medium text-ink">{t('myStores.webhookSecret')}</span>
            <code className="block bg-surface-muted rounded px-3 py-2 text-xs break-all" dir="ltr">{result.webhookSecret}</code>
            <p className="text-xs text-amber-600">{t('myStores.secretOnce')}</p>
          </div>
        )}
        <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label={t('myStores.platform')} value={platform} onChange={(e) => setPlatform(e.target.value as StorePlatform)}>
          {PLATFORMS.map((p) => <option key={p} value={p}>{t(`myStores.platforms.${p}`)}</option>)}
        </Select>
        <TextField label={t('myStores.shopDomain')} value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} placeholder="my-store.myshopify.com" dir="ltr" />
      </div>
      <p className="text-xs text-muted">{t('myStores.domainHint')}</p>
      {connect.isError && <Alert>{t('myStores.connectError')}</Alert>}
      <Button disabled={shopDomain.trim().length < 3 || connect.isPending} onClick={() => connect.mutate()}>
        {connect.isPending ? t('common.pleaseWait') : t('myStores.beginOAuth')}
      </Button>
    </Card>
  );
}
