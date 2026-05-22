import { api } from './client';
import type { Notification, NotificationCategory, NotificationChannel, NotificationStatus, SmsProvider } from '../types';

export interface ListNotificationsParams {
  channel?: NotificationChannel;
  category?: NotificationCategory;
  status?: NotificationStatus;
}
export async function listNotifications(params: ListNotificationsParams): Promise<Notification[]> {
  const { data } = await api.get<Notification[]>('/notifications', { params });
  return data;
}
export async function sendNotification(input: { channel: NotificationChannel; recipient: string; body: string; subject?: string; provider?: SmsProvider }): Promise<Notification> {
  const { data } = await api.post<Notification>('/notifications/send', input);
  return data;
}
export async function runAlertChecks(): Promise<{ alertsCreated: number; details: { category: string; count: number }[] }> {
  const { data } = await api.post('/notifications/run-alerts', {});
  return data;
}
export async function generateDigest(clientId: string): Promise<Notification> {
  const { data } = await api.post<Notification>('/notifications/digest', { clientId });
  return data;
}
