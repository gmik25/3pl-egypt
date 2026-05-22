import { api } from './client';
import type {
  HsCode,
  ImportShipmentDetail,
  ImportShipmentListItem,
  ImportStatus,
  LandedCost,
} from '../types';

// ---- HS codes ----

export async function listHsCodes(search?: string): Promise<HsCode[]> {
  const { data } = await api.get<HsCode[]>('/customs/hs-codes', { params: { search } });
  return data;
}
export async function upsertHsCode(input: { code: string; description: string; dutyRateBps: number }): Promise<HsCode> {
  const { data } = await api.put<HsCode>('/customs/hs-codes', input);
  return data;
}

// ---- Import shipments ----

export async function listImports(status?: ImportStatus, clientId?: string): Promise<ImportShipmentListItem[]> {
  const { data } = await api.get<ImportShipmentListItem[]>('/customs/imports', { params: { status, clientId } });
  return data;
}
export async function getImport(id: string): Promise<ImportShipmentDetail> {
  const { data } = await api.get<ImportShipmentDetail>(`/customs/imports/${id}`);
  return data;
}
export async function getLandedCost(id: string): Promise<LandedCost> {
  const { data } = await api.get<LandedCost>(`/customs/imports/${id}/landed-cost`);
  return data;
}

export interface CreateImportInput {
  clientId: string;
  warehouseId?: string;
  originCountry?: string;
  supplierName?: string;
  freightCostPiastres?: number;
  insuranceCostPiastres?: number;
  bonded?: boolean;
  lines: { skuId: string; quantity: number; unitCostPiastres: number; hsCode?: string }[];
}
export async function createImport(input: CreateImportInput): Promise<ImportShipmentDetail> {
  const { data } = await api.post<ImportShipmentDetail>('/customs/imports', input);
  return data;
}
export async function declareImport(id: string, ecaDeclarationNumber: string): Promise<ImportShipmentDetail> {
  const { data } = await api.post<ImportShipmentDetail>(`/customs/imports/${id}/declare`, { ecaDeclarationNumber });
  return data;
}
export async function inspectImport(id: string): Promise<ImportShipmentDetail> {
  const { data } = await api.post<ImportShipmentDetail>(`/customs/imports/${id}/inspect`, {});
  return data;
}
export async function clearImport(id: string): Promise<ImportShipmentDetail> {
  const { data } = await api.post<ImportShipmentDetail>(`/customs/imports/${id}/clear`, {});
  return data;
}
export async function releaseImport(id: string, locationId: string): Promise<ImportShipmentDetail> {
  const { data } = await api.post<ImportShipmentDetail>(`/customs/imports/${id}/release`, { locationId });
  return data;
}
