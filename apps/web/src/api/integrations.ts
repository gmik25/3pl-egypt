import { api } from './client';
import type { GovernorateCode } from '@3pl/shared';
import type { ConnectStoreResult, CourierAccount, CourierTestResult, StoreConnection, StorePlatform } from '../types';

// ---- Couriers (carrier onboarding) ----

export async function listCouriers(): Promise<CourierAccount[]> {
  const { data } = await api.get<CourierAccount[]>('/integrations/couriers');
  return data;
}

export async function getCourier(id: string): Promise<CourierAccount> {
  const { data } = await api.get<CourierAccount>(`/integrations/couriers/${id}`);
  return data;
}

export interface CreateCourierInput {
  code: string;
  name: string;
  apiBaseUrl?: string;
  apiKey?: string;
  webhookSecret?: string;
}
export async function createCourier(input: CreateCourierInput): Promise<CourierAccount> {
  const { data } = await api.post<CourierAccount>('/integrations/couriers', input);
  return data;
}

export interface UpdateCourierInput {
  name?: string;
  apiBaseUrl?: string;
  isActive?: boolean;
  /** Empty/omitted = leave unchanged; a value rotates the secret. */
  apiKey?: string;
  webhookSecret?: string;
}
export async function updateCourier(id: string, input: UpdateCourierInput): Promise<CourierAccount> {
  const { data } = await api.patch<CourierAccount>(`/integrations/couriers/${id}`, input);
  return data;
}

export interface CoverageEntry {
  governorate: GovernorateCode;
  etaDays: number;
  isServiceable?: boolean;
}
export async function setCourierCoverage(id: string, entries: CoverageEntry[]): Promise<CourierAccount> {
  const { data } = await api.put<CourierAccount>(`/integrations/couriers/${id}/coverage`, { entries });
  return data;
}

export async function testCourierConnection(id: string): Promise<CourierTestResult> {
  const { data } = await api.post<CourierTestResult>(`/integrations/couriers/${id}/test-connection`, {});
  return data;
}

// ---- Store connections (seller onboarding) ----

export async function listStores(): Promise<StoreConnection[]> {
  const { data } = await api.get<StoreConnection[]>('/integrations/stores');
  return data;
}

export async function connectStore(input: { clientId: string; platform: StorePlatform; shopDomain: string }): Promise<ConnectStoreResult> {
  const { data } = await api.post<ConnectStoreResult>('/integrations/stores/connect', input);
  return data;
}

export async function disconnectStore(id: string): Promise<StoreConnection> {
  const { data } = await api.post<StoreConnection>(`/integrations/stores/${id}/disconnect`, {});
  return data;
}

export async function resubscribeStore(id: string): Promise<{ topics: string[]; simulated: boolean; backfillQueued: boolean }> {
  const { data } = await api.post<{ topics: string[]; simulated: boolean; backfillQueued: boolean }>(`/integrations/stores/${id}/resubscribe`, {});
  return data;
}
