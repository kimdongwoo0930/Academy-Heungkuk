"use client";

import { usePolling } from "@/hooks/usePolling";
import { searchReservations } from "@/lib/api/reservation";
import { Reservation } from "@/types/reservation";
import { useEffect, useState } from "react";

interface SearchParams {
  keyword?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  page: number;
  size?: number;
  /** 외부에서 강제 재조회가 필요할 때 증가시키는 tick */
  tick?: number;
}

interface SearchResult {
  reservations: Reservation[];
  totalElements: number;
  totalPages: number;
  loading: boolean;
  /** 마지막으로 목록을 갱신한 시각 (폴링 포함) */
  lastUpdated: Date;
  /** 지금 바로 재조회 (새로고침 버튼용) */
  refetchNow: () => void;
}

/**
 * 예약 검색 공통 훅
 * - searchReservations API 호출 및 결과 상태 관리
 * - params 중 하나라도 바뀌면 자동 재조회
 * - 1분마다 조용히(로딩 표시 없이) 재조회 — 다른 사용자의 변경사항 반영용
 */
export function useReservationSearch(params: SearchParams): SearchResult {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const runFetch = (silent: boolean) => {
    if (!silent) setLoading(true);
    return searchReservations({
      keyword: params.keyword || undefined,
      status: params.status || undefined,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined,
      page: params.page,
      size: params.size ?? 20,
      sort: params.sort,
    })
      .then((result) => {
        setReservations(result.content);
        setTotalElements(result.totalElements);
        setTotalPages(result.totalPages);
      })
      .catch(() => {})
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    runFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params.keyword,
    params.status,
    params.startDate,
    params.endDate,
    params.sort,
    params.page,
    params.size,
    params.tick,
  ]);

  const { lastUpdated, refetchNow } = usePolling(() => runFetch(true), 60_000);

  return { reservations, totalElements, totalPages, loading, lastUpdated, refetchNow };
}
