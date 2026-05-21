import { api } from './client';
import type { GovernorateCode, OrderState, PaymentMethod } from '@3pl/shared';
import type {
  CodLedgerEntry,
  CodLedgerType,
  CodSummary,
  CsvImportResult,
  OrderDetail,
  OrderListItem,
  Paginated,
} from '../types';

export interface ListOrdersParams {
  clientId?: string;
  state?: OrderState;
  governorate?: GovernorateCode;
  search?: string;
  from?: string;
  to?: string;
  flaggedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listOrders(params: ListOrdersParams): Promise<Paginated<OrderListItem>> {
  const { data } = await api.get<Paginated<OrderListItem>>('/orders', { params });
  return data;
}

export async function getOrder(id: string): Promise<OrderDetail> {
  const { data } = await api.get<OrderDetail>(`/orders/${id}`);
  return data;
}

export interface CreateOrderItemInput {
  skuCode: string;
  nameAr?: string;
  quantity: number;
  unitPricePiastres: number;
}

export interface CreateOrderInput {
  clientId: string;
  externalRef?: string;
  customerName: string;
  customerPhone: string;
  customerPhoneAlt?: string;
  addressApartment?: string;
  addressFloor?: string;
  addressBuilding?: string;
  addressStreet?: string;
  addressDistrict?: string;
  governorate: GovernorateCode;
  notes?: string;
  paymentMethod: PaymentMethod;
  codAmountPiastres?: number;
  items: CreateOrderItemInput[];
}

export async function createOrder(input: CreateOrderInput): Promise<OrderDetail> {
  const { data } = await api.post<OrderDetail>('/orders', input);
  return data;
}

export async function transitionOrder(id: string, toState: OrderState, reason?: string): Promise<OrderDetail> {
  const { data } = await api.post<OrderDetail>(`/orders/${id}/transition`, { toState, reason });
  return data;
}

export async function addCodEntry(
  id: string,
  type: CodLedgerType,
  amountPiastres: number,
  note?: string,
): Promise<CodLedgerEntry> {
  const { data } = await api.post<CodLedgerEntry>(`/orders/${id}/cod`, { type, amountPiastres, note });
  return data;
}

export async function getCodSummary(clientId?: string): Promise<CodSummary> {
  const { data } = await api.get<CodSummary>('/orders/cod/summary', { params: { clientId } });
  return data;
}

export async function importOrdersCsv(clientId: string, file: File): Promise<CsvImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<CsvImportResult>(`/intake/csv/${clientId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
