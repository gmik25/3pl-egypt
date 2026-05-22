import { api } from './client';
import type { OpsOverview, PortalSummary } from '../types';

export async function getPortalSummary(): Promise<PortalSummary> {
  const { data } = await api.get<PortalSummary>('/dashboard/portal');
  return data;
}

export async function getOpsOverview(): Promise<OpsOverview> {
  const { data } = await api.get<OpsOverview>('/dashboard/ops');
  return data;
}
