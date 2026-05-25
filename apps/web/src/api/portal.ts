import { api } from './client';
import type { Contract, ConnectStoreResult, StoreConnection, StorePlatform } from '../types';
import type { GovernorateCode } from '@3pl/shared';

export interface PortalClient {
  id: string;
  legalName: string;
  tradingName: string | null;
  governorate: GovernorateCode;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isActive: boolean;
  createdAt: string;
}

export async function getMyClient(): Promise<PortalClient> {
  const { data } = await api.get<PortalClient>('/portal/me');
  return data;
}

export async function getMyContracts(): Promise<Contract[]> {
  const { data } = await api.get<Contract[]>('/portal/me/contracts');
  return data;
}

// ---- Self-serve store connect (seller owns the clientId server-side) ----

export async function listMyStores(): Promise<StoreConnection[]> {
  const { data } = await api.get<StoreConnection[]>('/portal/stores');
  return data;
}

export async function connectMyStore(input: { platform: StorePlatform; shopDomain: string }): Promise<ConnectStoreResult> {
  const { data } = await api.post<ConnectStoreResult>('/portal/stores/connect', input);
  return data;
}

export async function disconnectMyStore(id: string): Promise<StoreConnection> {
  const { data } = await api.post<StoreConnection>(`/portal/stores/${id}/disconnect`, {});
  return data;
}
