import { api } from './client';
import type {
  CodByDriverRow,
  EligibleCodOrder,
  Invoice,
  InvoiceStatus,
  Payout,
  PayoutRail,
  PayoutStatus,
  Remittance,
  RemittanceStatus,
  Statement,
  StorageBillingPreview,
  Wallet,
} from '../types';

// ---- Remittances ----

export async function eligibleCodOrders(): Promise<EligibleCodOrder[]> {
  const { data } = await api.get<EligibleCodOrder[]>('/finance/remittances/eligible-orders');
  return data;
}
export async function listRemittances(status?: RemittanceStatus): Promise<Remittance[]> {
  const { data } = await api.get<Remittance[]>('/finance/remittances', { params: { status } });
  return data;
}
export async function createRemittance(input: { driverId?: string; orderIds: string[]; declaredAmountPiastres: number; note?: string }): Promise<Remittance> {
  const { data } = await api.post<Remittance>('/finance/remittances', input);
  return data;
}
export async function confirmRemittance(id: string): Promise<Remittance> {
  const { data } = await api.post<Remittance>(`/finance/remittances/${id}/confirm`, {});
  return data;
}
export async function rejectRemittance(id: string, note?: string): Promise<Remittance> {
  const { data } = await api.post<Remittance>(`/finance/remittances/${id}/reject`, { note });
  return data;
}
export async function codByDriver(from?: string, to?: string): Promise<CodByDriverRow[]> {
  const { data } = await api.get<CodByDriverRow[]>('/finance/remittances/cod-by-driver', { params: { from, to } });
  return data;
}

// ---- Wallets / statement ----

export async function getWallet(clientId: string): Promise<Wallet> {
  const { data } = await api.get<Wallet>(`/finance/wallets/${clientId}`);
  return data;
}
export async function getStatement(clientId: string, from?: string, to?: string): Promise<Statement> {
  const { data } = await api.get<Statement>(`/finance/wallets/${clientId}/statement`, { params: { from, to } });
  return data;
}

// ---- Payouts ----

export async function listPayouts(clientId?: string, status?: PayoutStatus): Promise<Payout[]> {
  const { data } = await api.get<Payout[]>('/finance/payouts', { params: { clientId, status } });
  return data;
}
export async function createPayout(input: { clientId: string; amountPiastres: number; rail: PayoutRail; externalRef?: string }): Promise<Payout> {
  const { data } = await api.post<Payout>('/finance/payouts', input);
  return data;
}
export async function markPayoutPaid(id: string, externalRef?: string): Promise<Payout> {
  const { data } = await api.post<Payout>(`/finance/payouts/${id}/paid`, { externalRef });
  return data;
}
export async function markPayoutFailed(id: string): Promise<Payout> {
  const { data } = await api.post<Payout>(`/finance/payouts/${id}/failed`, {});
  return data;
}

// ---- Invoices ----

export async function listInvoices(clientId?: string, status?: InvoiceStatus): Promise<Invoice[]> {
  const { data } = await api.get<Invoice[]>('/finance/invoices', { params: { clientId, status } });
  return data;
}
export async function getInvoice(id: string): Promise<Invoice> {
  const { data } = await api.get<Invoice>(`/finance/invoices/${id}`);
  return data;
}
export async function generateInvoice(input: { clientId: string; periodStart: string; periodEnd: string }): Promise<Invoice> {
  const { data } = await api.post<Invoice>('/finance/invoices/generate', input);
  return data;
}
export async function issueInvoice(id: string): Promise<Invoice> {
  const { data } = await api.post<Invoice>(`/finance/invoices/${id}/issue`, {});
  return data;
}
export async function getInvoiceEta(id: string): Promise<unknown> {
  const { data } = await api.get(`/finance/invoices/${id}/eta`);
  return data;
}

// ---- Dedicated-storage billing ----

export async function previewStorageBilling(clientId: string, periodStart: string, periodEnd: string): Promise<StorageBillingPreview> {
  const { data } = await api.get<StorageBillingPreview>(`/finance/storage-billing/${clientId}/preview`, { params: { periodStart, periodEnd } });
  return data;
}
export async function chargeStorageBilling(clientId: string, periodStart: string, periodEnd: string): Promise<StorageBillingPreview> {
  const { data } = await api.post<StorageBillingPreview>(`/finance/storage-billing/${clientId}/charge`, { periodStart, periodEnd });
  return data;
}
