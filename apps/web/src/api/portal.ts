import { api } from './client';
import type { Contract } from '../types';
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
