import instance from './instance';
import { ApiResponse } from '@/types/api';
import { AccountInfo, CreateAccountRequest } from '@/types/account';

export type { AccountInfo, CreateAccountRequest };

export async function createAccount(data: CreateAccountRequest): Promise<AccountInfo> {
  const res = await instance.post<ApiResponse<AccountInfo>>('/v1/admin/accounts', data);
  return res.data.data;
}

export async function getAccounts(): Promise<AccountInfo[]> {
  const res = await instance.get<ApiResponse<AccountInfo[]>>('/v1/admin/accounts');
  return res.data.data;
}

export async function updateAccountRole(id: number, role: string): Promise<void> {
  await instance.patch(`/v1/admin/accounts/${id}/role`, { role });
}

export async function deleteAccount(id: number): Promise<void> {
  await instance.delete(`/v1/admin/accounts/${id}`);
}

export async function updateAccountPassword(id: number, newPassword: string): Promise<void> {
  await instance.patch(`/v1/admin/accounts/${id}/password`, { newPassword });
}

export async function updateMyPassword(newPassword: string): Promise<void> {
  await instance.patch('/v1/admin/accounts/me/password', { newPassword });
}
