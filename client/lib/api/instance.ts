import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '@/types/api';
import { LoginResponse } from '@/types/auth';
import { useAuthStore } from '@/store/auth';

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 다른 origin(api.academy-hk.com / localhost:8888)으로 refresh 쿠키를 주고받으려면 필요
  // (없으면 브라우저가 Set-Cookie 를 저장하지 않고, 요청에 쿠키도 붙이지 않음)
  withCredentials: true,
});

// 재시도 대상에서 빼는 인증 API — 이 요청들의 401 은 "토큰 만료"가 아니라 결과 그 자체
const AUTH_PATHS = ['/v1/auth/login', '/v1/auth/reissue', '/v1/auth/logout'];
const LOGIN_PAGE = '/auth/login';
const REISSUE_LOCK = 'auth-reissue';

// ── access 토큰 재발급 ─────────────────────────────────────────────
// 진행 중인 재발급 Promise — 동시에 여러 요청이 401 이어도 reissue 는 한 번만 보내고 모두 이 결과를 기다린다 (대기열)
let refreshPromise: Promise<string | null> | null = null;

async function requestReissue(): Promise<string | null> {
  try {
    // instance 를 쓰면 이 요청의 401 이 다시 인터셉터로 들어가므로 기본 axios 로 호출
    const res = await axios.post<ApiResponse<LoginResponse>>(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/auth/reissue`,
      null,
      { withCredentials: true },
    );
    const token = res.data.data.accessToken;
    useAuthStore.getState().setAccessToken(token);
    return token;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

/**
 * refresh 쿠키로 새 access 토큰을 받아 메모리에 저장한다. 실패하면 null.
 * - 같은 탭: refreshPromise 로 한 번만 요청
 * - 여러 탭: Web Locks 로 한 번에 하나씩 → 앞 탭이 rotation 한 최신 쿠키로 다음 탭이 요청 (옛 쿠키로 401 나는 것 방지)
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = reissueWithLock().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function reissueWithLock(): Promise<string | null> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return requestReissue();
  // locks.request 는 콜백이 반환한 Promise 가 끝날 때까지 락을 잡고 있다가 그 결과를 돌려준다
  return await locks.request(REISSUE_LOCK, () => requestReissue());
}

function redirectToLogin() {
  useAuthStore.getState().clear();
  if (typeof window !== 'undefined' && window.location.pathname !== LOGIN_PAGE) {
    window.location.href = LOGIN_PAGE;
  }
}

// ── 인터셉터 ─────────────────────────────────────────────────────
// 요청 — 메모리의 access 토큰 첨부
instance.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// 응답 — 401 이면 재발급 1회 시도 후 원래 요청 재시도, 재발급 실패 시 로그인 페이지로
instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const isAuthRequest = AUTH_PATHS.some((path) => config?.url?.includes(path));

    if (error.response?.status !== 401 || !config || isAuthRequest || config._retry) {
      return Promise.reject(error);
    }
    config._retry = true;

    // 이 요청이 실패하는 사이 다른 요청이 이미 재발급을 끝냈다면 새 토큰으로 바로 재시도
    const usedToken = config.headers.Authorization?.toString().replace('Bearer ', '');
    const currentToken = useAuthStore.getState().accessToken;
    const token =
      currentToken && currentToken !== usedToken ? currentToken : await refreshAccessToken();

    if (!token) {
      redirectToLogin();
      return Promise.reject(error);
    }
    config.headers.Authorization = `Bearer ${token}`;
    return instance(config);
  },
);

export default instance;
