export interface LoginRequest {
  userId: string;
  password: string;
}

// refreshToken 은 바디가 아니라 HttpOnly 쿠키로 내려온다
export interface LoginResponse {
  accessToken: string;
}
