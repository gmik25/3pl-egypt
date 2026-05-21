import { useTranslation } from 'react-i18next';
import type { ShipmentStatus } from '../../types';
import { Badge } from '../ui';

const TONE: Record<ShipmentStatus, 'slate' | 'blue' | 'amber' | 'green' | 'red'> = {
  PENDING: 'slate',
  ASSIGNED: 'blue',
  OUT_FOR_DELIVERY: 'amber',
  DELIVERED: 'green',
  FAILED: 'red',
  RETURNED: 'red',
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const { t } = useTranslation();
  return <Badge tone={TONE[status]}>{t(`fleet.statuses.${status}`)}</Badge>;
}
