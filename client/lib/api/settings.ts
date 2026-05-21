import instance from './instance';
import { ApiResponse } from '@/types/api';

export async function getSettings(): Promise<Record<string, string>> {
  const res = await instance.get<ApiResponse<Record<string, string>>>('/v1/admin/settings');
  return res.data.data ?? {};
}

export async function saveSettings(settings: Record<string, string>): Promise<void> {
  await instance.put('/v1/admin/settings', { settings });
}

export async function getDisabledClassrooms(): Promise<string[]> {
  const res = await instance.get<ApiResponse<string[]>>('/v1/admin/settings/disabledClassroom');
  return res.data.data ?? [];
}

export async function saveDisabledClassrooms(codes: string[]): Promise<void> {
  await instance.put('/v1/admin/settings/disabledClassroom', codes);
}

export async function getDisabledRooms(): Promise<string[]> {
  const res = await instance.get<ApiResponse<string[]>>('/v1/admin/settings/disabledRoom');
  return res.data.data ?? [];
}

export async function saveDisabledRooms(codes: string[]): Promise<void> {
  await instance.put('/v1/admin/settings/disabledRoom', codes);
}
