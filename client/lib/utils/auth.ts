import { useAuthStore } from '@/store/auth';

// 아래 함수들은 메모리(zustand)의 access 토큰 기준 — admin layout 이 토큰을 준비한 뒤에 렌더링되는 화면에서 사용
export function getCurrentUserRole(): string | null {
  return useAuthStore.getState().role;
}

export function isAdmin(): boolean {
  return getCurrentUserRole() === 'ROLE_ADMIN';
}

export function getCurrentUserId(): string | null {
  return useAuthStore.getState().userId;
}
