import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GOVERNORATES, formatEgp } from '@3pl/shared';

import {
  capturePodPhoto,
  capturePodSignature,
  getShipment,
  markOutForDelivery,
  recordFailure,
  requestPodOtp,
  verifyPodOtp,
} from '../../api/fleet';
import type { DeliveryFailureReason } from '../../types';
import { useAuthStore } from '../../stores/auth.store';
import { Button, Card, Select, TextField, Spinner, Badge, Alert } from '../../components/ui';
import { ShipmentStatusBadge } from '../../components/fleet/ShipmentStatusBadge';
import { currentLocale } from '../../i18n';

const FAIL_REASONS: DeliveryFailureReason[] = ['CUSTOMER_UNREACHABLE', 'ADDRESS_NOT_FOUND', 'CUSTOMER_REFUSED', 'POSTPONED', 'OTHER'];

export default function ShipmentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const locale = currentLocale();
  const egpLoc = locale === 'ar' ? 'ar-EG' : 'en-EG';
  const canDeliver = useAuthStore((s) => s.hasPermission('delivery.execute'));
  const photoRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);

  const [failReason, setFailReason] = useState<DeliveryFailureReason>('CUSTOMER_UNREACHABLE');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [recipient, setRecipient] = useState('');
  const [error, setError] = useState<string | null>(null);

  const shipment = useQuery({ queryKey: ['shipment', id], queryFn: () => getShipment(id!), enabled: !!id });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['shipment', id] });
  const onErr = (e: any) => setError(e?.response?.data?.message ?? t('fleet.actionError'));

  const ofd = useMutation({ mutationFn: () => markOutForDelivery(id!), onSuccess: () => { setError(null); refresh(); }, onError: onErr });
  const fail = useMutation({ mutationFn: () => recordFailure(id!, failReason), onSuccess: () => { setError(null); refresh(); }, onError: onErr });
  const reqOtp = useMutation({ mutationFn: () => requestPodOtp(id!), onSuccess: (r) => { setDevCode(r.devCode ?? null); setError(null); }, onError: onErr });
  const verOtp = useMutation({ mutationFn: () => verifyPodOtp(id!, otp, recipient || undefined), onSuccess: () => { setOtp(''); setDevCode(null); setError(null); refresh(); }, onError: onErr });
  const podPhoto = useMutation({ mutationFn: (f: File) => capturePodPhoto(id!, f, recipient || undefined), onSuccess: () => { setError(null); refresh(); }, onError: onErr });
  const podSig = useMutation({ mutationFn: (f: File) => capturePodSignature(id!, f, recipient || undefined), onSuccess: () => { setError(null); refresh(); }, onError: onErr });

  if (shipment.isLoading || !shipment.data) return <Spinner />;
  const s = shipment.data;
  const gov = GOVERNORATES.find((g) => g.code === s.governorate);
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(egpLoc, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(iso));
  const isOpen = s.status !== 'DELIVERED' && s.status !== 'RETURNED';

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <Link to="/shipments" className="text-sm text-brand-600 hover:underline">← {t('fleet.title')}</Link>
          <h1 className="text-2xl font-bold mt-1" dir="ltr">{s.reference}</h1>
        </div>
        <ShipmentStatusBadge status={s.status} />
      </div>

      <Card className="p-6">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-slate-500">{t('fleet.carrier')}</dt><dd>{s.carrierType === 'COURIER' ? (s.courierAccount?.name ?? '—') : (s.driver?.fullName ?? t('fleet.inHouse'))}</dd></div>
          {s.trackingNumber && <div><dt className="text-slate-500">{t('fleet.tracking')}</dt><dd dir="ltr">{s.trackingNumber}</dd></div>}
          <div><dt className="text-slate-500">{t('orders.customer')}</dt><dd>{s.order?.customerName}</dd></div>
          <div><dt className="text-slate-500">{t('orders.phone')}</dt><dd dir="ltr">{s.order?.customerPhone}</dd></div>
          <div><dt className="text-slate-500">{t('clients.governorate')}</dt><dd>{locale === 'ar' ? gov?.nameAr : gov?.nameEn}</dd></div>
          {s.order?.paymentMethod === 'COD' && s.order.codAmountPiastres != null && (
            <div><dt className="text-slate-500">{t('orders.codAmount')}</dt><dd>{formatEgp(s.order.codAmountPiastres, { locale: egpLoc })}</dd></div>
          )}
        </dl>
      </Card>

      {/* Actions */}
      {canDeliver && isOpen && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">{t('fleet.actions')}</h2>
          {error && <Alert>{error}</Alert>}

          {(s.status === 'ASSIGNED' || s.status === 'FAILED') && (
            <Button onClick={() => ofd.mutate()} disabled={ofd.isPending}>{t('fleet.outForDelivery')}</Button>
          )}

          {s.status === 'OUT_FOR_DELIVERY' && (
            <div className="space-y-4">
              <TextField label={t('fleet.recipientName')} value={recipient} onChange={(e) => setRecipient(e.target.value)} />

              {/* OTP */}
              <div className="border border-slate-200 rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">{t('fleet.podOtp')}</p>
                <div className="flex gap-2 items-end">
                  <Button variant="secondary" onClick={() => reqOtp.mutate()} disabled={reqOtp.isPending}>{t('fleet.sendOtp')}</Button>
                  <TextField label={t('auth.mfaCode')} inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} />
                  <Button onClick={() => verOtp.mutate()} disabled={otp.length < 6 || verOtp.isPending}>{t('fleet.verifyDeliver')}</Button>
                </div>
                {devCode && <p className="text-xs text-amber-600">{t('fleet.devCode')}: <code>{devCode}</code></p>}
              </div>

              {/* Photo / signature */}
              <div className="border border-slate-200 rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">{t('fleet.podFile')}</p>
                <div className="flex gap-4 flex-wrap text-sm">
                  <div>
                    <span className="block text-xs text-slate-500 mb-1">{t('fleet.photo')}</span>
                    <input ref={photoRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) podPhoto.mutate(f); }} />
                  </div>
                  <div>
                    <span className="block text-xs text-slate-500 mb-1">{t('fleet.signature')}</span>
                    <input ref={sigRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) podSig.mutate(f); }} />
                  </div>
                </div>
              </div>

              {/* Failed attempt */}
              <div className="border border-slate-200 rounded-md p-3 space-y-2">
                <p className="text-sm font-medium">{t('fleet.recordFailure')}</p>
                <div className="flex gap-2 items-end">
                  <Select label={t('fleet.failureReason')} value={failReason} onChange={(e) => setFailReason(e.target.value as DeliveryFailureReason)}>
                    {FAIL_REASONS.map((r) => <option key={r} value={r}>{t(`fleet.failureReasons.${r}`)}</option>)}
                  </Select>
                  <Button variant="danger" onClick={() => fail.mutate()} disabled={fail.isPending}>{t('fleet.recordFailure')}</Button>
                </div>
                <p className="text-xs text-slate-400">{t('fleet.attemptsNote', { count: s.attemptCount })}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* POD */}
      {s.pod && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">{t('fleet.proofOfDelivery')}</h2>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Badge tone="green">{t(`fleet.podMethods.${s.pod.method}`)}</Badge>
            {s.pod.recipientName && <span className="text-slate-600">{t('fleet.recipientName')}: {s.pod.recipientName}</span>}
            <span className="text-slate-400">{fmtDate(s.pod.capturedAt)}</span>
          </div>
          {s.pod.photoUrl && <p className="text-xs text-slate-400 mt-2" dir="ltr">{s.pod.photoUrl}</p>}
          {s.pod.signatureUrl && <p className="text-xs text-slate-400 mt-2" dir="ltr">{s.pod.signatureUrl}</p>}
        </Card>
      )}

      {/* Attempts */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-3">{t('fleet.attemptHistory')}</h2>
        {s.attempts.length === 0 ? <p className="text-sm text-slate-400">{t('common.noResults')}</p> : (
          <ol className="space-y-2 text-sm">
            {s.attempts.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <span className="text-slate-400 text-xs whitespace-nowrap">{fmtDate(a.createdAt)}</span>
                {a.success ? <Badge tone="green">{t('fleet.delivered')}</Badge> : <Badge tone="red">{a.failureReason ? t(`fleet.failureReasons.${a.failureReason}`) : t('fleet.failed')}</Badge>}
                <span className="text-slate-500">#{a.attemptNumber}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
