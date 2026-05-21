import { api } from './client';
import type { AuditAction, AuditEntry, Paginated } from '../types';

export interface ListAuditParams {
  userId?: string;
  action?: AuditAction;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listAudit(params: ListAuditParams): Promise<Paginated<AuditEntry>> {
  const { data } = await api.get<Paginated<AuditEntry>>('/audit', { params });
  return data;
}
