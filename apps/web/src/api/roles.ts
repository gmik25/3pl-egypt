import { api } from './client';
import type { Role } from '../types';

export async function listRoles(): Promise<Role[]> {
  const { data } = await api.get<Role[]>('/roles');
  return data;
}
