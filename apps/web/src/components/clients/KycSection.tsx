import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listKyc, uploadKyc, reviewKyc } from '../../api/clients';
import type { KycDocType } from '../../types';
import { Button, Card, Select, Spinner, Badge, Alert } from '../ui';
import { currentLocale } from '../../i18n';

const DOC_TYPES: KycDocType[] = ['COMMERCIAL_REGISTRATION', 'TAX_CARD', 'NATIONAL_ID'];

export function KycSection({ clientId }: { clientId: string }) {
  const { t } = useTranslation();
  const locale = currentLocale();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<KycDocType>('COMMERCIAL_REGISTRATION');

  const docs = useQuery({ queryKey: ['kyc', clientId], queryFn: () => listKyc(clientId) });

  const upload = useMutation({
    mutationFn: (file: File) => uploadKyc(clientId, docType, file),
    onSuccess: () => {
      if (fileRef.current) fileRef.current.value = '';
      void qc.invalidateQueries({ queryKey: ['kyc', clientId] });
    },
  });

  const review = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) => reviewKyc(id, approved),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['kyc', clientId] }),
  });

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-EG', {
      dateStyle: 'medium',
      timeZone: 'Africa/Cairo',
    }).format(new Date(iso));

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-semibold">{t('kyc.title')}</h2>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Select label={t('kyc.docType')} value={docType} onChange={(e) => setDocType(e.target.value as KycDocType)}>
            {DOC_TYPES.map((d) => (
              <option key={d} value={d}>
                {t(`kyc.types.${d}`)}
              </option>
            ))}
          </Select>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
          }}
          className="text-sm"
        />
        {upload.isPending && <span className="text-sm text-muted">{t('common.pleaseWait')}</span>}
      </div>
      {upload.isError && <Alert>{t('kyc.uploadError')}</Alert>}

      {docs.isLoading ? (
        <Spinner />
      ) : docs.data && docs.data.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted border-b border-line">
                <th className="text-start font-medium px-3 py-2">{t('kyc.docType')}</th>
                <th className="text-start font-medium px-3 py-2">{t('kyc.uploaded')}</th>
                <th className="text-start font-medium px-3 py-2">{t('kyc.reviewStatus')}</th>
                <th className="text-start font-medium px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {docs.data.map((d) => (
                <tr key={d.id} className="border-b border-line-soft">
                  <td className="px-3 py-2">{t(`kyc.types.${d.type}`)}</td>
                  <td className="px-3 py-2 text-body">{fmtDate(d.uploadedAt)}</td>
                  <td className="px-3 py-2">
                    {d.approved === null ? (
                      <Badge tone="amber">{t('kyc.pending')}</Badge>
                    ) : d.approved ? (
                      <Badge tone="green">{t('kyc.approved')}</Badge>
                    ) : (
                      <Badge tone="red">{t('kyc.rejected')}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {d.approved === null && (
                      <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => review.mutate({ id: d.id, approved: true })}>
                          {t('kyc.approve')}
                        </Button>
                        <Button variant="danger" onClick={() => review.mutate({ id: d.id, approved: false })}>
                          {t('kyc.reject')}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-faint">{t('kyc.none')}</p>
      )}
    </Card>
  );
}
