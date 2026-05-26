import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/auth.store';
import { Card, Badge } from '../components/ui';

export default function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('dashboard.welcome', { name: user?.fullName ?? '' })}</h1>
        <p className="text-muted mt-1">{t('dashboard.subtitle')}</p>
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('dashboard.yourAccess')}</h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted">{t('users.email')}: </span>
            <span className="font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-muted">{t('users.roles')}: </span>
            {user?.roles.map((r) => (
              <Badge key={r.role.id} tone="blue">
                {t(`roles.${r.role.name}`)}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted">{t('users.mfa')}: </span>
            {user?.mfaSecret?.confirmed ? (
              <Badge tone="green">{t('mfa.enabled')}</Badge>
            ) : (
              <Badge tone="amber">{t('mfa.notEnabled')}</Badge>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
