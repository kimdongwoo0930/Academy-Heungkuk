"use client";

import { getSurveyPage } from "@/lib/api/survey";
import { SurveyResult } from "@/types/survey";
import { useEffect, useState } from "react";

interface SearchParams {
  keyword?: string;
  page: number;
  size?: number;
}

interface SearchResult {
  surveys: SurveyResult[];
  totalElements: number;
  totalPages: number;
  loading: boolean;
}

/**
 * 설문 결과 검색 공통 훅
 * - getSurveyPage API 호출 및 결과 상태 관리
 * - keyword / page / size 중 하나라도 바뀌면 자동 재조회
 */
export function useSurveySearch(params: SearchParams): SearchResult {
  const [surveys, setSurveys] = useState<SurveyResult[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getSurveyPage({
      keyword: params.keyword || undefined,
      page: params.page,
      size: params.size ?? 20,
    })
      .then((result) => {
        setSurveys(result.content);
        setTotalElements(result.totalElements);
        setTotalPages(result.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.keyword, params.page, params.size]);

  return { surveys, totalElements, totalPages, loading };
}
