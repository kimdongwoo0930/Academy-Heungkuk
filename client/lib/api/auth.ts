import instance from './instance';
import { ApiResponse } from '@/types/api';
import { LoginRequest, LoginResponse } from '@/types/auth';

export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const res = await instance.post<ApiResponse<LoginResponse>>('/v1/auth/login', data);
  return res.data.data;
};

// 이 기기 세션 삭제 + refresh 쿠키 만료 (서버는 항상 200)
export const logout = async (): Promise<void> => {
  await instance.post('/v1/auth/logout');
};
