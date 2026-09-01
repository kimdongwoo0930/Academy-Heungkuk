'use client';

import SurveyCard from '@/components/survey/SurveyCard';
import SurveyStatsChart from '@/components/survey/SurveyStatsChart';
import { useSurveySearch } from '@/hooks/useSurveySearch';
import { getAllSurveys } from '@/lib/api/survey';
import { SurveyResult } from '@/types/survey';
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
      <div className={styles.contentHeader}>
        <div>
          <div className={styles.contentTitle}>설문 결과</div>
          <div className={styles.contentSub}>설문이 완료된 예약의 응답을 확인합니다.</div>
        </div>
        <div className={styles.searchBar}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="단체명 / 예약코드 / 담당자 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <SurveyStatsChart surveys={allSurveys} />

      <div className={styles.listHeader}>
        <span className={styles.countLabel}>전체 {totalElements}건</span>
      </div>

      <div className={styles.list}>
        {loading && <div className={styles.empty}>불러오는 중...</div>}
        {!loading && surveys.map((s) => <SurveyCard key={s.id} data={s} />)}
        {!loading && surveys.length === 0 && (
          <div className={styles.empty}>
            {debounced ? '검색 결과가 없습니다.' : '등록된 설문 결과가 없습니다.'}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button disabled={page === 0} onClick={() => setPage(0)}>
            {'«'}
          </button>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            {'‹'}
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            {'›'}
          </button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
            {'»'}
          </button>
        </div>
      )}
    </div>
  );
}
