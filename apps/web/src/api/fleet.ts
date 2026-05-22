import { api } from './client';
import type { GovernorateCode } from '@3pl/shared';
import type {
  CarrierSuggestion,
  CarrierType,
  DeliveryFailureReason,
  Driver,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentStatus,
} from '../types';

// ---- Drivers ----

export async function listDrivers(governorate?: GovernorateCode, availableOnly?: boolean): Promise<Driver[]> {
  const { data } = await api.get<Driver[]>('/fleet/drivers', { params: { governorate, availableOnly } });
  return data;
}
export async function registerDriver(input: { userId: string; vehicleType?: string; plateNumber?: string; zones?: GovernorateCode[] }): Promise<Driver> {
  const { data } = await api.post<Driver>('/fleet/drivers', input);
  return data;
}
export async function updateDriver(userId: string, input: { vehicleType?: string; plateNumber?: string; isAvailable?: boolean; zones?: GovernorateCode[] }): Promise<Driver> {
  const { data } = await api.patch<Driver>(`/fleet/drivers/${userId}`, input);
  return data;
}

// ---- Shipments ----

export interface ListShipmentsParams {
  status?: ShipmentStatus;
  governorate?: GovernorateCode;
  carrierType?: CarrierType;
  driverId?: string;
}
export async function listShipments(params: ListShipmentsParams): Promise<ShipmentListItem[]> {
  const { data } = await api.get<ShipmentListItem[]>('/fleet/shipments', { params });
  return data;
}
export async function getShipment(id: string): Promise<ShipmentDetail> {
  const { data } = await api.get<ShipmentDetail>(`/fleet/shipments/${id}`);
  return data;
}
export async function suggestCarriers(governorate: GovernorateCode): Promise<CarrierSuggestion> {
  const { data } = await api.get<CarrierSuggestion>(`/fleet/shipments/coverage/${governorate}`);
  return data;
}
export async function createShipment(input: { orderId: string; carrierType: CarrierType; courierId?: string; driverId?: string }): Promise<ShipmentDetail> {
  const { data } = await api.post<ShipmentDetail>('/fleet/shipments', input);
  return data;
}
export async function markOutForDelivery(id: string): Promise<ShipmentDetail> {
  const { data } = await api.post<ShipmentDetail>(`/fleet/shipments/${id}/out-for-delivery`, {});
  return data;
}
export async function recordFailure(id: string, failureReason: DeliveryFailureReason, note?: string): Promise<ShipmentDetail> {
  const { data } = await api.post<ShipmentDetail>(`/fleet/shipments/${id}/fail`, { failureReason, note });
  return data;
}
export async function requestPodOtp(id: string): Promise<{ sentTo: string; devCode?: string }> {
  const { data } = await api.post<{ sentTo: string; devCode?: string }>(`/fleet/shipments/${id}/pod/otp/request`, {});
  return data;
}
export async function verifyPodOtp(id: string, code: string, recipientName?: string): Promise<ShipmentDetail> {
  const { data } = await api.post<ShipmentDetail>(`/fleet/shipments/${id}/pod/otp/verify`, { code, recipientName });
  return data;
}
export async function capturePodPhoto(id: string, file: File, recipientName?: string): Promise<ShipmentDetail> {
  const form = new FormData();
  form.append('file', file);
  if (recipientName) form.append('recipientName', recipientName);
  const { data } = await api.post<ShipmentDetail>(`/fleet/shipments/${id}/pod/photo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}
export async function capturePodSignature(id: string, file: File, recipientName?: string): Promise<ShipmentDetail> {
  const form = new FormData();
  form.append('file', file);
  if (recipientName) form.append('recipientName', recipientName);
  const { data } = await api.post<ShipmentDetail>(`/fleet/shipments/${id}/pod/signature`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}
