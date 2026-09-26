import instance from './instance';
import { ApiResponse } from '@/types/api';
import { LoginRequest, LoginResponse } from '@/types/auth';

export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const res = await instance.post<ApiResponse<LoginResponse>>('/v1/auth/login', data);
  return res.data.data;
};
