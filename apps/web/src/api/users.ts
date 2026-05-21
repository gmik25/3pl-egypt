import { api } from './client';
import type { GovernorateCode, UserRole } from '@3pl/shared';
import type { Paginated, UserDetail, UserSummary } from '../types';

export interface ListUsersParams {
  role?: UserRole;
  governorate?: GovernorateCode;
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listUsers(params: ListUsersParams): Promise<Paginated<UserSummary>> {
  const { data } = await api.get<Paginated<UserSummary>>('/users', { params });
  return data;
}

export async function getUser(id: string): Promise<UserDetail> {
  const { data } = await api.get<UserDetail>(`/users/${id}`);
  return data;
}

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  roles?: UserRole[];
  scopedGovernorates?: GovernorateCode[];
  clientId?: string;
  isActive?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<UserDetail> {
  const { data } = await api.post<UserDetail>('/users', input);
  return data;
}

export interface UpdateUserInput {
  fullName?: string;
  phone?: string;
  isActive?: boolean;
  scopedGovernorates?: GovernorateCode[];
  password?: string;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserDetail> {
  const { data } = await api.patch<UserDetail>(`/users/${id}`, input);
  return data;
}

export async function deactivateUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function assignRole(id: string, role: UserRole): Promise<UserDetail> {
  const { data } = await api.post<UserDetail>(`/users/${id}/roles`, { role });
  return data;
}

export async function revokeRole(id: string, roleId: string): Promise<void> {
  await api.delete(`/users/${id}/roles/${roleId}`);
}
