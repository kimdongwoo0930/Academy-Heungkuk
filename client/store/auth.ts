import { create } from 'zustand';
import { parseJwtPayload } from '@/lib/utils/jwt';

/**
 * access 토큰은 localStorage 가 아니라 메모리(zustand)에만 보관한다.
 * - localStorage 는 XSS 스크립트가 그대로 읽어 외부로 보낼 수 있고, 브라우저를 닫아도 남는다.
 * - 메모리는 새로고침/탭 종료 시 사라지므로, 새로고침 후에는 refresh 쿠키로 다시 받아온다 (admin layout).
 * refresh 토큰은 HttpOnly 쿠키라 JS 에서 다루지 않는다.
 */
interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: string | null;
  setAccessToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  userId: null,
  role: null,
  setAccessToken: (token) => {
    let userId: string | null = null;
    let role: string | null = null;
    try {
      const payload = parseJwtPayload(token);
      userId = (payload.sub as string) ?? null;
      role = (payload.role as string) ?? null;
    } catch {
      // 형식이 잘못된 토큰이면 사용자 정보만 비워둔다 (서버가 401 로 거부함)
    }
    set({ accessToken: token, userId, role });
  },
  clear: () => set({ accessToken: null, userId: null, role: null }),
}));
