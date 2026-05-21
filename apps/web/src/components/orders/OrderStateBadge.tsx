import { useTranslation } from 'react-i18next';
import type { OrderState } from '@3pl/shared';
import { Badge } from '../ui';

const TONE: Record<OrderState, 'slate' | 'blue' | 'amber' | 'green' | 'red'> = {
  PENDING: 'amber',
  PICKED: 'blue',
  PACKED: 'blue',
  DISPATCHED: 'blue',
  DELIVERED: 'green',
  FAILED: 'red',
  RETURNED: 'red',
};

export function OrderStateBadge({ state }: { state: OrderState }) {
  const { t } = useTranslation();
  return <Badge tone={TONE[state]}>{t(`orders.states.${state}`)}</Badge>;
}
