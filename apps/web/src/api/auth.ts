import { api } from './client';
import type { AuthTokens, UserDetail } from '../types';

export interface LoginInput {
  email: string;
  password: string;
  mfaCode?: string;
  deviceLabel?: string;
}

export async function login(input: LoginInput): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/login', input);
  return data;
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/refresh', { refreshToken });
  return data;
}

export async function logout(refreshToken?: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken });
}

export async function me(): Promise<UserDetail> {
  const { data } = await api.get<UserDetail>('/users/me');
  return data;
}

export interface MfaEnrollResponse {
  secret: string;
  otpauthUri: string;
}

export async function mfaEnroll(): Promise<MfaEnrollResponse> {
  const { data } = await api.post<MfaEnrollResponse>('/auth/mfa/enroll', {});
  return data;
}

export async function mfaVerify(code: string): Promise<void> {
  await api.post('/auth/mfa/verify', { code });
}
