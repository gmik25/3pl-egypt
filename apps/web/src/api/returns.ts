import { api } from './client';
import type {
  PortalLookup,
  ReturnDetail,
  ReturnDisposition,
  ReturnListItem,
  ReturnReason,
  ReturnStatus,
} from '../types';

// ---- Public portal ----

export async function lookupOrderForReturn(reference: string, phone: string): Promise<PortalLookup> {
  const { data } = await api.get<PortalLookup>('/returns/portal/lookup', { params: { reference, phone } });
  return data;
}
export async function submitPortalReturn(input: {
  orderReference: string;
  customerPhone: string;
  reason: ReturnReason;
  customerNote?: string;
  items: { skuId: string; quantity: number }[];
}): Promise<{ rmaNumber: string }> {
  const { data } = await api.post<{ rmaNumber: string }>('/returns/portal', input);
  return data;
}

// ---- Admin ----

export async function listReturns(status?: ReturnStatus, clientId?: string): Promise<ReturnListItem[]> {
  const { data } = await api.get<ReturnListItem[]>('/returns', { params: { status, clientId } });
  return data;
}
export async function getReturn(id: string): Promise<ReturnDetail> {
  const { data } = await api.get<ReturnDetail>(`/returns/${id}`);
  return data;
}
export async function approveReturn(id: string): Promise<ReturnDetail> {
  const { data } = await api.post<ReturnDetail>(`/returns/${id}/approve`, {});
  return data;
}
export async function rejectReturn(id: string): Promise<ReturnDetail> {
  const { data } = await api.post<ReturnDetail>(`/returns/${id}/reject`, {});
  return data;
}
export async function receiveReturn(id: string): Promise<ReturnDetail> {
  const { data } = await api.post<ReturnDetail>(`/returns/${id}/received`, {});
  return data;
}
export async function inspectReturnItem(itemId: string, disposition: ReturnDisposition, restockLocationId: string) {
  const { data } = await api.post(`/returns/items/${itemId}/inspect`, { disposition, restockLocationId });
  return data;
}
export async function markReturnInspected(id: string): Promise<ReturnDetail> {
  const { data } = await api.post<ReturnDetail>(`/returns/${id}/inspected`, {});
  return data;
}
export async function disposeReturnItem(itemId: string) {
  const { data } = await api.post(`/returns/items/${itemId}/dispose`, {});
  return data;
}
export async function closeReturn(id: string): Promise<ReturnDetail> {
  const { data } = await api.post<ReturnDetail>(`/returns/${id}/close`, {});
  return data;
}
