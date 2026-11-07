'use client';

import { useReservationSearch } from '@/hooks/useReservationSearch';
import { downloadConfirmation, downloadEstimate, downloadTrade } from '@/lib/api/reservation';
import { Check, FileText, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

const STATUS_OPTIONS = ['전체', '확정', '예약', '문의', '취소'];

const PAGE_SIZE = 15;

export default function DocumentPage() {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [tradingId, setTradingId] = useState<number | null>(null);

  // 검색어 디바운스 + 페이지 리셋
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const { reservations, totalPages, loading } = useReservationSearch({
    keyword: debouncedKeyword,
    status: status || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sort: 'startDate,desc',
    page,
    size: PAGE_SIZE,
  });

  const handleEstimate = async (id: number, org: string) => {
    setDownloadingId(id);
    try {
      await downloadEstimate(id, org);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleTrade = async (id: number, org: string) => {
    setTradingId(id);
    try {
      await downloadTrade(id, org);
    } finally {
      setTradingId(null);
    }
  };

  const handleConfirmation = async (id: number, org: string) => {
    setConfirmingId(id);
    try {
      await downloadConfirmation(id, org);
    } finally {
      setConfirmingId(null);
    }
  };

  // 페이지 번호 배열 (최대 5개 표시)
  const pageNumbers = () => {
    const delta = 2;
    const start = Math.max(0, page - delta);
    const end = Math.min(totalPages - 1, page + delta);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const handleStatusChange = (s: string) => {
    setStatus(s === '전체' ? '' : (status === s ? '' : s));
    setPage(0);
  };

  const handleReset = () => { setKeyword(''); setStatus(''); setStartDate(''); setEndDate(''); setPage(0); };

  const handleSearch = () => { setDebouncedKeyword(keyword); setPage(0); };

  const hasFilter = !!(keyword || status || startDate || endDate);

  const docButtons = (r: { id: number; organization: string }) => [
    { label: '견적서', busy: downloadingId === r.id, run: () => handleEstimate(r.id, r.organization) },
    { label: '확인서', busy: confirmingId === r.id, run: () => handleConfirmation(r.id, r.organization) },
    { label: '거래명세서', busy: tradingId === r.id, run: () => handleTrade(r.id, r.organization) },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>문서 관리</h1>
        <p className={styles.pageDesc}>예약별로 견적서, 확인서, 거래명세서를 발급합니다</p>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>상태</span>
          <div className={styles.chips} role="group" aria-label="예약 상태 필터">
            {STATUS_OPTIONS.map((s) => {
              const active = s === '전체' ? status === '' : status === s;
              return (
                <button
                  key={s}
                  type="button"
                  className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                  aria-pressed={active}
                  onClick={() => handleStatusChange(s)}
                >
                  {active && <Check size={13} aria-hidden="true" />}
                  {s}
                </button>
              );
            })}
          </div>
          <div className={styles.filterRowRight}>
            <span className={styles.filterLabel}>이용일</span>
            <input
              type="date"
              className={styles.dateInput}
              aria-label="이용 시작일"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(0); }}
            />
            <span className={styles.dateSep}>–</span>
            <input
              type="date"
              className={styles.dateInput}
              aria-label="이용 종료일"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(0); }}
            />
            {hasFilter && (
              <button type="button" className={styles.resetBtn} onClick={handleReset}>초기화</button>
            )}
          </div>
        </div>
        <div className={styles.searchRow}>
          <label className={styles.searchField}>
            <Search size={16} aria-hidden="true" />
            <input
              className={styles.searchInput}
              placeholder="단체명 / 담당자를 입력하세요."
              aria-label="문서 대상 검색"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
          </label>
          <button type="button" className={styles.searchBtn} onClick={handleSearch}>검색</button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>단체 / 예약코드</th>
              <th>이용 기간</th>
              <th>담당자</th>
              <th>상태 / 인원</th>
              <th>문서 발급</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className={styles.emptyCell}>불러오는 중...</td></tr>
            ) : reservations.length === 0 ? (
              <tr><td colSpan={5} className={styles.emptyCell}>검색 결과가 없습니다.</td></tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className={styles.orgCell}>
                      <span className={styles.dot} style={{ backgroundColor: r.colorCode }} aria-hidden="true" />
                      <div className={styles.orgBlock}>
                        <div className={styles.org} title={r.organization}>{r.organization}</div>
                        <div className={styles.code}>{r.reservationCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.num}>{String(r.startDate)} ~ {String(r.endDate)}</td>
                  <td>
                    <div className={styles.customer}>{r.customer || '—'}</div>
                    <div className={styles.sub}>{r.customerPhone || '—'}</div>
                  </td>
                  <td>
                    <div className={styles.statusCell}>
                      <span className={`${styles.badge} ${styles[r.status]}`}>{r.status}</span>
                      {r.people != null && <span className={styles.sub}>{r.people}명</span>}
                    </div>
                  </td>
                  <td>
                    <div className={styles.docBtns}>
                      {docButtons(r).map((b) => (
                        <button
                          key={b.label}
                          type="button"
                          className={styles.docBtn}
                          disabled={b.busy}
                          onClick={b.run}
                          aria-label={`${r.organization} ${b.label} 발급`}
                        >
                          <FileText size={14} aria-hidden="true" />
                          {b.busy ? '생성 중...' : b.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && reservations.length > 0 && (
        <div className={styles.pagination}>
          <button type="button" className={styles.pageBtn} aria-label="첫 페이지" disabled={page === 0} onClick={() => setPage(0)}>«</button>
          <button type="button" className={styles.pageBtn} aria-label="이전 페이지" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
          {pageNumbers().map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.pageBtn} ${n === page ? styles.pageBtnActive : ''}`}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => setPage(n)}
            >
              {n + 1}
            </button>
          ))}
          <button type="button" className={styles.pageBtn} aria-label="다음 페이지" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
          <button type="button" className={styles.pageBtn} aria-label="마지막 페이지" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
          <span className={styles.pageInfo}>{page + 1} / {totalPages || 1}</span>
        </div>
      )}
    </div>
  );
}
