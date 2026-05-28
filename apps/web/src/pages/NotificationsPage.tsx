import { Inbox } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listClients } from '../api/clients';
import { generateDigest, listNotifications, runAlertChecks, sendNotification } from '../api/notifications';
import type { NotificationChannel, NotificationStatus } from '../types';
import { Button, Card, Select, TextField, Badge, Alert, TableSkeleton, EmptyState } from '../components/ui';
import { currentLocale } from '../i18n';

const CHANNELS: NotificationChannel[] = ['SMS', 'WHATSAPP', 'EMAIL', 'INTERNAL'];
const STATUSES: NotificationStatus[] = ['PENDING', 'SENT', 'FAILED'];

const CHANNEL_TONE: Record<NotificationChannel, 'green' | 'blue' | 'amber' | 'slate'> = {
  SMS: 'blue', WHATSAPP: 'green', EMAIL: 'amber', INTERNAL: 'slate',
};
const STATUS_TONE: Record<NotificationStatus, 'amber' | 'green' | 'red'> = { PENDING: 'amber', SENT: 'green', FAILED: 'red' };

export default function NotificationsPage() {
  const { t } = useTranslation();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const qc = useQueryClient();

  const [channel, setChannel] = useState<NotificationChannel | ''>('');
  const [status, setStatus] = useState<NotificationStatus | ''>('');
  const [toRecipient, setToRecipient] = useState('');
  const [body, setBody] = useState('');
  const [sendChannel, setSendChannel] = useState<NotificationChannel>('SMS');
  const [digestClient, setDigestClient] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const clients = useQuery({ queryKey: ['clients', 'all'], queryFn: () => listClients({ pageSize: 100 }) });
  const feed = useQuery({
    queryKey: ['notifications', channel, status],
    queryFn: () => listNotifications({ channel: channel || undefined, status: status || undefined }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['notifications'] });

  const runAlerts = useMutation({ mutationFn: runAlertChecks, onSuccess: (r) => { setBanner(t('notifications.alertsRun', { count: r.alertsCreated })); refresh(); } });
  const send = useMutation({ mutationFn: () => sendNotification({ channel: sendChannel, recipient: toRecipient, body }), onSuccess: () => { setToRecipient(''); setBody(''); setBanner(t('notifications.sent')); refresh(); } });
  const digest = useMutation({ mutationFn: () => generateDigest(digestClient), onSuccess: () => { setBanner(t('notifications.digestSent')); refresh(); } });

  const fmtDate = (iso: string) => new Intl.DateTimeFormat(egpLoc, { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(iso));

  return (
    <div className="max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">{t('notifications.title')}</h1>
      {banner && <Alert tone="green">{banner}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">{t('notifications.alerts')}</h2>
          <p className="text-sm text-muted">{t('notifications.alertsHint')}</p>
          <Button onClick={() => runAlerts.mutate()} disabled={runAlerts.isPending}>{t('notifications.runAlerts')}</Button>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">{t('notifications.sendTest')}</h2>
          <Select label={t('notifications.channel')} value={sendChannel} onChange={(e) => setSendChannel(e.target.value as NotificationChannel)}>
            {CHANNELS.map((c) => <option key={c} value={c}>{t(`notifications.channels.${c}`)}</option>)}
          </Select>
          <TextField label={t('notifications.recipient')} value={toRecipient} onChange={(e) => setToRecipient(e.target.value)} placeholder="+2010… / email" />
          <TextField label={t('notifications.body')} value={body} onChange={(e) => setBody(e.target.value)} />
          <Button disabled={!toRecipient || !body || send.isPending} onClick={() => send.mutate()}>{t('notifications.send')}</Button>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="text-lg font-semibold">{t('notifications.digest')}</h2>
          <Select label={t('orders.client')} value={digestClient} onChange={(e) => setDigestClient(e.target.value)}>
            <option value="">{t('orders.selectClient')}</option>
            {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.legalName}</option>)}
          </Select>
          <Button disabled={!digestClient || digest.isPending} onClick={() => digest.mutate()}>{t('notifications.sendDigest')}</Button>
        </Card>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label={t('notifications.channel')} value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel | '')}>
            <option value="">{t('common.all')}</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{t(`notifications.channels.${c}`)}</option>)}
          </Select>
          <Select label={t('orders.state')} value={status} onChange={(e) => setStatus(e.target.value as NotificationStatus | '')}>
            <option value="">{t('common.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`notifications.statuses.${s}`)}</option>)}
          </Select>
        </div>
      </Card>

      <Card>
        {feed.isLoading ? <TableSkeleton cols={6} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b border-line">
                  <th className="text-start font-medium px-4 py-3">{t('audit.when')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('notifications.channel')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('notifications.category')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('notifications.recipient')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('notifications.message')}</th>
                  <th className="text-start font-medium px-4 py-3">{t('orders.state')}</th>
                </tr>
              </thead>
              <tbody>
                {feed.data?.map((n) => (
                  <tr key={n.id} className="border-b border-line-soft">
                    <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(n.createdAt)}</td>
                    <td className="px-4 py-3"><Badge tone={CHANNEL_TONE[n.channel]}>{t(`notifications.channels.${n.channel}`)}</Badge></td>
                    <td className="px-4 py-3 text-body">{t(`notifications.categories.${n.category}`)}</td>
                    <td className="px-4 py-3 text-body" dir="ltr">{n.recipient}</td>
                    <td className="px-4 py-3 text-body max-w-xs truncate">{n.subject ? `${n.subject} — ` : ''}{n.body}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[n.status]}>{t(`notifications.statuses.${n.status}`)}</Badge></td>
                  </tr>
                ))}
                {feed.data?.length === 0 && <tr><td colSpan={6}><EmptyState icon={Inbox} title={t('common.empty')} hint={t('common.emptyHint')} /></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
