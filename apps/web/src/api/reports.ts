import { api } from './client';
import type { CourierScore, InventoryRow, OpsKpis, RevenueRow } from '../types';

export interface RangeParams {
  from?: string;
  to?: string;
}

export async function getOpsKpis(params: RangeParams): Promise<OpsKpis> {
  const { data } = await api.get<OpsKpis>('/reports/ops-kpis', { params });
  return data;
}
export async function getRevenuePerClient(params: RangeParams): Promise<RevenueRow[]> {
  const { data } = await api.get<RevenueRow[]>('/reports/revenue-per-client', { params });
  return data;
}
export async function getCourierScorecard(params: RangeParams): Promise<CourierScore[]> {
  const { data } = await api.get<CourierScore[]>('/reports/courier-scorecard', { params });
  return data;
}
export async function getInventoryReport(): Promise<InventoryRow[]> {
  const { data } = await api.get<InventoryRow[]>('/reports/inventory');
  return data;
}

/** Download an authenticated CSV (carries the JWT via the axios client, then triggers a browser save). */
export async function downloadCsv(path: string, params: RangeParams, filename: string): Promise<void> {
  const res = await api.get(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
