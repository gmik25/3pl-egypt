import { api } from './client';
import type { GovernorateCode } from '@3pl/shared';
import type {
  ClientDetail,
  ClientSummary,
  Contract,
  KycDocType,
  KycDocument,
  Paginated,
  Quote,
  Sla,
} from '../types';

export interface ListClientsParams {
  governorate?: GovernorateCode;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listClients(params: ListClientsParams): Promise<Paginated<ClientSummary>> {
  const { data } = await api.get<Paginated<ClientSummary>>('/clients', { params });
  return data;
}

export async function getClient(id: string): Promise<ClientDetail> {
  const { data } = await api.get<ClientDetail>(`/clients/${id}`);
  return data;
}

export interface ClientInput {
  legalName: string;
  tradingName?: string;
  taxId?: string;
  commercialRegistration?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  addressApartment?: string;
  addressFloor?: string;
  addressBuilding?: string;
  addressStreet?: string;
  addressDistrict?: string;
  governorate: GovernorateCode;
}

export async function createClient(input: ClientInput): Promise<ClientDetail> {
  const { data } = await api.post<ClientDetail>('/clients', input);
  return data;
}

export async function updateClient(id: string, input: Partial<ClientInput> & { isActive?: boolean }) {
  const { data } = await api.patch<ClientDetail>(`/clients/${id}`, input);
  return data;
}

// ---- KYC ----

export async function listKyc(clientId: string): Promise<KycDocument[]> {
  const { data } = await api.get<KycDocument[]>(`/clients/${clientId}/kyc`);
  return data;
}

export async function uploadKyc(clientId: string, type: KycDocType, file: File): Promise<KycDocument> {
  const form = new FormData();
  form.append('type', type);
  form.append('file', file);
  const { data } = await api.post<KycDocument>(`/clients/${clientId}/kyc`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function reviewKyc(docId: string, approved: boolean): Promise<KycDocument> {
  const { data } = await api.patch<KycDocument>(`/clients/kyc/${docId}/review`, { approved });
  return data;
}

// ---- Contracts ----

export async function listContracts(clientId: string): Promise<Contract[]> {
  const { data } = await api.get<Contract[]>(`/clients/${clientId}/contracts`);
  return data;
}

export interface ContractInput {
  startsOn: string;
  endsOn?: string;
  storagePerSkuPerDayPiastres: number;
  pickAndPackPiastres: number;
  codCommissionBps: number;
  returnFeePiastres: number;
}

export async function createContract(clientId: string, input: ContractInput): Promise<Contract> {
  const { data } = await api.post<Contract>(`/clients/${clientId}/contracts`, input);
  return data;
}

export async function updateContract(id: string, input: Partial<ContractInput> & { isActive?: boolean }) {
  const { data } = await api.patch<Contract>(`/contracts/${id}`, input);
  return data;
}

export interface SlaInput {
  handlingTimeMinutes: number;
  deliveryWindowDaysCairo: number;
  deliveryWindowDaysOther: number;
  maxReturnRateBps: number;
}

export async function upsertSla(contractId: string, input: SlaInput): Promise<Sla> {
  const { data } = await api.put<Sla>(`/contracts/${contractId}/sla`, input);
  return data;
}

export interface QuoteInput {
  skuCount?: number;
  storageDays?: number;
  orderCount?: number;
  codAmountPiastres?: number;
  returnCount?: number;
}

export async function quoteContract(contractId: string, input: QuoteInput): Promise<Quote> {
  const { data } = await api.post<Quote>(`/contracts/${contractId}/quote`, input);
  return data;
}
