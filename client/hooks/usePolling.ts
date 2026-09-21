"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PollingResult {
  /** 마지막으로 데이터를 갱신한 시각 (폴링 / 포커스 복귀 / 수동 새로고침 포함) */
  lastUpdated: Date;
  /** 지금 바로 한 번 더 갱신 (새로고침 버튼용) */
  refetchNow: () => void;
}

/**
 * 주기적으로(intervalMs) callback을 재실행 + 탭이 다시 활성화될 때도 즉시 한 번 실행.
 * 다른 사용자가 만든 변경사항을 새로고침 없이 화면에 반영하기 위한 용도.
 *
 * callback이 Promise를 반환하면 완료 시점에 lastUpdated를 갱신하고,
 * 아니면(void) 호출 시점에 바로 갱신한다.
 * callback은 매 렌더마다 최신 클로저를 ref에 담아두고 호출하므로,
 * 호출부에서 useCallback으로 감쌀 필요 없이 그냥 인라인 함수를 넘기면 된다.
 */
export function usePolling(
  callback: () => void | Promise<unknown>,
  intervalMs: number,
): PollingResult {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const tick = useCallback(() => {
    const result = savedCallback.current();
    if (result && typeof (result as Promise<unknown>).finally === "function") {
      (result as Promise<unknown>).finally(() => setLastUpdated(new Date()));
    } else {
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    const id = setInterval(tick, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs, tick]);

  return { lastUpdated, refetchNow: tick };
}
