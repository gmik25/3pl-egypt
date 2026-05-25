import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../../stores/auth.store';
import { Card, Button, Alert } from '../../components/ui';

/**
 * Neutral landing after the OAuth round-trip. Reachable by any authenticated user (not
 * permission-gated) so both ops staff and CLIENT sellers can complete the flow.
 */
export default function StoreConnectedPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const ok = params.get('status') === 'ok';
  const platform = params.get('platform');
  const simulated = !!params.get('simulated');
  const reason = params.get('reason');

  const backTo = hasPermission('integrations.read') ? '/integrations/stores' : '/portal/stores';

  return (
    <div className="max-w-lg mx-auto mt-10">
      <Card className="p-8 space-y-5 text-center">
        {ok ? (
          <>
            <div className="text-4xl">✅</div>
            <h1 className="text-xl font-bold">{t('storeConnected.okTitle')}</h1>
            <p className="text-slate-600">{t('storeConnected.okBody', { platform: platform ?? '' })}</p>
            {simulated && <Alert tone="amber">{t('storeConnected.simulated')}</Alert>}
          </>
        ) : (
          <>
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-bold">{t('storeConnected.failTitle')}</h1>
            <Alert tone="red">{t('storeConnected.failBody', { reason: reason ?? 'unknown' })}</Alert>
          </>
        )}
        <Link to={backTo}>
          <Button>{t('storeConnected.back')}</Button>
        </Link>
      </Card>
    </div>
  );
}
