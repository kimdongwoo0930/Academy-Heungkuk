'use client';

import ReservationDetailModal from '@/components/dashboard/ReservationDetailModal';
import ReservationModal from '@/components/reservation/ReservationModal';
import SurveyModal from '@/components/reservation/SurveyModal';
import RefreshStatus from '@/components/ui/RefreshStatus';
import { useReservationSearch } from '@/hooks/useReservationSearch';
import {
  createReservation,
  getReservationById,
  getReservationsByYear,
  hardDeleteReservation,
  toRequestBody,
  updateReservation,
} from '@/lib/api/reservation';
import { isAdmin } from '@/lib/utils/auth';
import { Reservation } from '@/types/reservation';
import { ArrowDown, ArrowUp, Check, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

const STATUS_OPTIONS = ['전체', '확정', '예약', '문의', '취소'];
const PAGE_SIZE = 20;
type SortField = 'createdAt' | 'startDate';
type SortDir = 'asc' | 'desc';

export default function ReservationPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('전체');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [fetchTick, setFetchTick] = useState(0);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalReservations, setModalReservations] = useState<Reservation[]>([]);
  // 관리자가 아니면 수정 모달 대신 읽기 전용 상세를 보여준다
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null);
  const [surveyTarget, setSurveyTarget] = useState<Reservation | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const admin = isAdmin();

  // 검색어 디바운스 + 페이지 리셋
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { reservations, totalElements, totalPages, loading, lastUpdated, refetchNow } = useReservationSearch({
    keyword: debouncedSearch,
    status: status === '전체' ? undefined : status,
    sort: `${sortBy},${sortDir}`,
    page,
    size: PAGE_SIZE,
    tick: fetchTick,
  });

  const handleStatusChange = (v: string) => { setStatus(v); setPage(0); };
  const handleSortChange = (field: SortField) => {
    if (field === sortBy) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setPage(0);
  };
  const refetch = () => setFetchTick((t) => t + 1);

  const fetchModalReservations = (years: number[]) => {
    Promise.all(years.map(getReservationsByYear))
      .then((results) => {
        const merged = [...new Map(results.flat().map((r) => [r.id, r])).values()];
        setModalReservations(merged);
      })
      .catch(() => { });
  };

  const openCreate = () => {
    setSelected(null);
    setIsModalOpen(true);
    const y = new Date().getFullYear();
    fetchModalReservations([y, y + 1]);
  };

  const openEdit = (r: Reservation) => {
    if (!admin) {
      getReservationById(r.id)
        .then(setDetailTarget)
        .catch(() => alert('예약 정보를 불러오지 못했습니다.'));
      return;
    }
    setSelected(r);
    setIsModalOpen(true);
    const startYear = new Date(r.startDate).getFullYear();
    const endYear = new Date(r.endDate).getFullYear();
    fetchModalReservations([...new Set([startYear, endYear])]);
  };

  const handleHardDelete = (r: Reservation) => {
    setConfirmDialog({
      message: `[${r.organization}] 예약을 완전히 삭제합니다.\n이 작업은 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        try {
          await hardDeleteReservation(r.id);
          refetch();
        } catch {
          alert('삭제 중 오류가 발생했습니다.');
        }
      },
    });
  };

  const handleSave = async (data: Reservation) => {
    const body = toRequestBody(data);
    if (selected !== null) {
      await updateReservation(selected.id, body);
    } else {
      await createReservation(body);
    }
    refetch();
  };

  const sortIcon = (field: SortField) =>
    sortBy === field ? (
      sortDir === 'desc' ? <ArrowDown size={13} aria-hidden="true" /> : <ArrowUp size={13} aria-hidden="true" />
    ) : null;

  const runSearch = () => {
    setDebouncedSearch(search);
    setPage(0);
  };

  return (
    <div className={styles.reservationPage}>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>예약 관리</h1>
        <p className={styles.pageDesc}>전체 예약을 조회하고 상태를 관리합니다</p>
      </div>

      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>상태</span>
          <div className={styles.chips} role="group" aria-label="예약 상태 필터">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`${styles.chip} ${status === s ? styles.chipActive : ''}`}
                aria-pressed={status === s}
                onClick={() => handleStatusChange(status === s ? '전체' : s)}
              >
                {status === s && <Check size={13} aria-hidden="true" />}
                {s}
              </button>
            ))}
          </div>
          <div className={styles.filterRowRight}>
            <div className={styles.sortBtns} role="group" aria-label="정렬">
              <button
                type="button"
                className={`${styles.sortBtn} ${sortBy === 'createdAt' ? styles.sortBtnActive : ''}`}
                aria-pressed={sortBy === 'createdAt'}
                onClick={() => handleSortChange('createdAt')}
              >
                등록일순 {sortIcon('createdAt')}
              </button>
              <button
                type="button"
                className={`${styles.sortBtn} ${sortBy === 'startDate' ? styles.sortBtnActive : ''}`}
                aria-pressed={sortBy === 'startDate'}
                onClick={() => handleSortChange('startDate')}
              >
                입실일순 {sortIcon('startDate')}
              </button>
            </div>
            {admin && (
              <button type="button" className={styles.addBtn} onClick={openCreate}>
                <Plus size={15} aria-hidden="true" />
                예약 등록
              </button>
            )}
          </div>
        </div>
        <div className={styles.searchRow}>
          <label className={styles.searchField}>
            <Search size={16} aria-hidden="true" />
            <input
              className={styles.searchInput}
              placeholder="단체명 / 담당자 / 연락처 / 예약코드를 입력하세요."
              aria-label="예약 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') runSearch();
              }}
            />
          </label>
          <button type="button" className={styles.searchBtn} onClick={runSearch}>
            검색
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.countLabel}>
          전체 <strong>{totalElements}</strong>건
        </span>
        <RefreshStatus lastUpdated={lastUpdated} onRefresh={refetchNow} />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>예약코드</th>
              <th>단체명</th>
              <th>목적</th>
              <th>인원</th>
              <th>담당자</th>
              <th>연락처</th>
              <th>이용 기간</th>
              <th>상태</th>
              {admin && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={admin ? 9 : 8} className={styles.emptyCell}>
                  불러오는 중...
                </td>
              </tr>
            ) : reservations.length === 0 ? (
              <tr>
                <td colSpan={admin ? 9 : 8} className={styles.emptyCell}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => openEdit(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target === e.currentTarget) openEdit(r);
                  }}
                >
                  <td className={styles.code}>{r.reservationCode}</td>
                  <td>
                    <span className={styles.orgCell}>
                      <span className={styles.colorDot} style={{ backgroundColor: r.colorCode }} aria-hidden="true" />
                      <span className={styles.orgName} title={r.organization}>
                        {r.organization}
                      </span>
                    </span>
                  </td>
                  <td className={styles.purpose} title={r.purpose}>
                    {r.purpose || '—'}
                  </td>
                  <td className={styles.num}>{r.people}명</td>
                  <td>{r.customer || '—'}</td>
                  <td className={styles.num}>{r.customerPhone || '—'}</td>
                  <td className={styles.num}>
                    {String(r.startDate)} ~ {String(r.endDate)}
                  </td>
                  <td>
                    <span className={`${styles.badge} ${styles[r.status]}`}>{r.status}</span>
                  </td>
                  {admin && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.surveyBtn}
                          onClick={() => setSurveyTarget(r)}
                          aria-label={`${r.organization} 설문`}
                        >
                          설문
                        </button>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => handleHardDelete(r)}
                          aria-label={`${r.organization} 삭제`}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button type="button" aria-label="첫 페이지" disabled={page === 0} onClick={() => setPage(0)}>{'«'}</button>
          <button type="button" aria-label="이전 페이지" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{'‹'}</button>
          <span>{page + 1} / {totalPages}</span>
          <button type="button" aria-label="다음 페이지" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>{'›'}</button>
          <button type="button" aria-label="마지막 페이지" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>{'»'}</button>
        </div>
      )}

      {isModalOpen && (
        <ReservationModal
          reservation={selected}
          allReservations={modalReservations}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {detailTarget && (
        <ReservationDetailModal reservation={detailTarget} onClose={() => setDetailTarget(null)} />
      )}

      {surveyTarget && (
        <SurveyModal
          reservationCode={surveyTarget.reservationCode}
          organization={surveyTarget.organization}
          onClose={() => setSurveyTarget(null)}
        />
      )}

      {confirmDialog && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox} role="alertdialog" aria-modal="true">
            <p className={styles.confirmMsg}>{confirmDialog.message}</p>
            <div className={styles.confirmBtns}>
              <button type="button" className={styles.confirmCancelBtn} onClick={() => setConfirmDialog(null)}>취소</button>
              <button type="button" className={styles.confirmOkBtn} onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
