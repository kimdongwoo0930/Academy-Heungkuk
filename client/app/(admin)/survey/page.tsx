'use client';

import SurveyStatsPanel from '@/components/survey/SurveyStatsPanel';
import SurveyTable from '@/components/survey/SurveyTable';
import { useSurveySearch } from '@/hooks/useSurveySearch';
import { getAllSurveys } from '@/lib/api/survey';
import { SurveyResult } from '@/types/survey';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

const PAGE_SIZE = 20;

export default function SurveyPage() {
  // 통계 차트는 전체 응답 기준으로 계산 (목록과 별개)
  const [allSurveys, setAllSurveys] = useState<SurveyResult[]>([]);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    getAllSurveys().then(setAllSurveys).catch(console.error);
  }, []);

  // 검색어 디바운스 → 첫 페이지로 이동
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { surveys, totalElements, totalPages, loading } = useSurveySearch({
    keyword: debounced,
    page,
    size: PAGE_SIZE,
  });

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>설문 결과</h1>
          <p className={styles.pageDesc}>설문이 완료된 예약의 응답을 확인합니다</p>
        </div>
        <div className={styles.searchField}>
          <Search size={15} aria-hidden="true" />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="단체명 / 예약코드 / 담당자 검색"
            aria-label="단체명, 예약코드, 담당자 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <SurveyStatsPanel surveys={allSurveys} />

      <section className={styles.listSection}>
        <div className={styles.listHead}>
          <h2 className={styles.listTitle}>응답 내역</h2>
          <span className={styles.listHint}>점수는 1(매우불만족) ~ 5(매우만족)</span>
        </div>

        {loading && <div className={styles.empty}>불러오는 중...</div>}
        {!loading && surveys.length > 0 && <SurveyTable key={`${debounced}-${page}`} surveys={surveys} />}
        {!loading && surveys.length === 0 && (
          <div className={styles.empty}>
            {debounced ? '검색 결과가 없습니다.' : '등록된 설문 결과가 없습니다.'}
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button aria-label="첫 페이지" disabled={page === 0} onClick={() => setPage(0)}>
            {'«'}
          </button>
          <button aria-label="이전 페이지" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {'‹'}
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button aria-label="다음 페이지" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            {'›'}
          </button>
          <button aria-label="마지막 페이지" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
            {'»'}
          </button>
        </div>
      )}
    </div>
  );
}
