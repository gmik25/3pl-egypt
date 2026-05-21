import { api } from './client';
import type { GovernorateCode } from '@3pl/shared';
import type {
  CycleCount,
  CycleCountStatus,
  InspectionResult,
  LowStockRow,
  Paginated,
  PurchaseOrder,
  PurchaseOrderStatus,
  Sku,
  StockLevel,
  StockMovement,
  Warehouse,
  WarehouseDetail,
  WmsLocation,
  ZoneType,
  LocationKind,
  StockStatus,
} from '../types';

// ---- Catalog (SKUs) ----

export interface ListSkusParams {
  clientId?: string;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}
export async function listSkus(params: ListSkusParams): Promise<Paginated<Sku>> {
  const { data } = await api.get<Paginated<Sku>>('/catalog/skus', { params });
  return data;
}
export interface SkuInput {
  clientId: string;
  code: string;
  nameAr: string;
  nameEn?: string;
  barcode?: string;
  unitOfMeasure?: string;
  expiryTracked?: boolean;
  reorderPointQty?: number;
  defaultUnitPricePiastres?: number;
}
export async function createSku(input: SkuInput): Promise<Sku> {
  const { data } = await api.post<Sku>('/catalog/skus', input);
  return data;
}
export async function updateSku(id: string, input: Partial<Omit<SkuInput, 'clientId' | 'code'>> & { isActive?: boolean }) {
  const { data } = await api.patch<Sku>(`/catalog/skus/${id}`, input);
  return data;
}

// ---- Warehouses / zones / locations ----

export async function listWarehouses(): Promise<Warehouse[]> {
  const { data } = await api.get<Warehouse[]>('/warehouses');
  return data;
}
export async function getWarehouse(id: string): Promise<WarehouseDetail> {
  const { data } = await api.get<WarehouseDetail>(`/warehouses/${id}`);
  return data;
}
export async function createWarehouse(input: { code: string; name: string; governorate: GovernorateCode }) {
  const { data } = await api.post<Warehouse>('/warehouses', input);
  return data;
}
export async function listLocations(warehouseId: string): Promise<WmsLocation[]> {
  const { data } = await api.get<WmsLocation[]>(`/warehouses/${warehouseId}/locations`);
  return data;
}
export async function createZone(warehouseId: string, input: { type: ZoneType; code: string; name: string }) {
  const { data } = await api.post(`/warehouses/${warehouseId}/zones`, input);
  return data;
}
export async function createLocation(
  warehouseId: string,
  input: { zoneId: string; code: string; type?: LocationKind; barcode?: string },
) {
  const { data } = await api.post(`/warehouses/${warehouseId}/locations`, input);
  return data;
}

// ---- Inventory ----

export async function stockBySku(skuId: string): Promise<StockLevel[]> {
  const { data } = await api.get<StockLevel[]>(`/inventory/sku/${skuId}`);
  return data;
}
export async function stockMovements(skuId: string): Promise<StockMovement[]> {
  const { data } = await api.get<StockMovement[]>(`/inventory/sku/${skuId}/movements`);
  return data;
}
export async function lowStock(warehouseId?: string): Promise<LowStockRow[]> {
  const { data } = await api.get<LowStockRow[]>('/inventory/low-stock', { params: { warehouseId } });
  return data;
}
export async function adjustStock(input: {
  skuId: string;
  locationId: string;
  deltaQty: number;
  status?: StockStatus;
  lotNumber?: string;
  expiryDate?: string;
  note?: string;
}) {
  const { data } = await api.post('/inventory/adjust', input);
  return data;
}
export async function changeStockStatus(input: {
  skuId: string;
  locationId: string;
  quantity: number;
  fromStatus: StockStatus;
  toStatus: StockStatus;
  lotId?: string;
  note?: string;
}) {
  const { data } = await api.post('/inventory/status', input);
  return data;
}

// ---- Inbound ----

export async function listPurchaseOrders(warehouseId?: string, status?: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
  const { data } = await api.get<PurchaseOrder[]>('/inbound/purchase-orders', { params: { warehouseId, status } });
  return data;
}
export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await api.get<PurchaseOrder>(`/inbound/purchase-orders/${id}`);
  return data;
}
export interface CreatePoInput {
  clientId: string;
  warehouseId: string;
  supplierName?: string;
  expectedDate?: string;
  notes?: string;
  lines: { skuId: string; quantityOrdered: number; lotNumber?: string; expiryDate?: string }[];
}
export async function createPurchaseOrder(input: CreatePoInput): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>('/inbound/purchase-orders', input);
  return data;
}
export async function receivePoLine(input: {
  poLineId: string;
  locationId: string;
  quantity: number;
  inspection: InspectionResult;
  lotNumber?: string;
  expiryDate?: string;
  note?: string;
}): Promise<PurchaseOrder> {
  const { data } = await api.post<PurchaseOrder>('/inbound/purchase-orders/receive', input);
  return data;
}

// ---- Cycle counts ----

export async function listCycleCounts(warehouseId?: string, status?: CycleCountStatus): Promise<CycleCount[]> {
  const { data } = await api.get<CycleCount[]>('/inventory/cycle-counts', { params: { warehouseId, status } });
  return data;
}
export async function openCycleCount(input: { warehouseId: string; locationId: string; skuId: string }): Promise<CycleCount> {
  const { data } = await api.post<CycleCount>('/inventory/cycle-counts', input);
  return data;
}
export async function recordCycleCount(id: string, countedQty: number): Promise<CycleCount> {
  const { data } = await api.post<CycleCount>(`/inventory/cycle-counts/${id}/count`, { countedQty });
  return data;
}
export async function reconcileCycleCount(id: string): Promise<CycleCount> {
  const { data } = await api.post<CycleCount>(`/inventory/cycle-counts/${id}/reconcile`, {});
  return data;
}
