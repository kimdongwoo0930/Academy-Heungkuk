/** JWT payload 디코딩 (서명 검증 없음 — 화면 표시용 userId/role 을 꺼낼 때만 사용, 권한 판단은 서버가 함) */
export function parseJwtPayload(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
  return JSON.parse(json);
}
