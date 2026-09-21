'use client';

import ReservationModal from '@/components/reservation/ReservationModal';
import SurveyModal from '@/components/reservation/SurveyModal';
import RefreshStatus from '@/components/ui/RefreshStatus';
import { useReservationSearch } from '@/hooks/useReservationSearch';
import {
  createReservation,
  getReservationsByYear,
  hardDeleteReservation,
  toRequestBody,
  updateReservation,
} from '@/lib/api/reservation';
import { isAdmin } from '@/lib/utils/auth';
import { Reservation } from '@/types/reservation';
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

  return (
    <div className={styles.reservationPage}>
      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>검색옵션</span>
          <div className={styles.statusCheckboxes}>
            {STATUS_OPTIONS.map((s) => (
              <label key={s} className={styles.statusCheckLabel}>
                <input
                  type="checkbox"
                  checked={status === s}
                  onChange={() => handleStatusChange(status === s ? '전체' : s)}
                />
                {s}
              </label>
            ))}
          </div>
          <div className={styles.filterRowRight}>
            <div className={styles.sortBtns}>
              <button
                className={`${styles.sortBtn} ${sortBy === 'createdAt' ? styles.sortBtnActive : ''}`}
                onClick={() => handleSortChange('createdAt')}
              >
                등록일순 {sortBy === 'createdAt' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button
                className={`${styles.sortBtn} ${sortBy === 'startDate' ? styles.sortBtnActive : ''}`}
                onClick={() => handleSortChange('startDate')}
              >
                입실일순 {sortBy === 'startDate' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
              </button>
            </div>
            {admin && <button className={styles.addBtn} onClick={openCreate}>+ 예약 등록</button>}
          </div>
        </div>
        <div className={styles.filterDivider} />
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>검색명</span>
          <input
            className={styles.searchInput}
            placeholder="단체명 / 담당자 / 연락처 / 예약코드를 입력하세요."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setDebouncedSearch(search); setPage(0); } }}
          />
          <button className={styles.searchBtn} onClick={() => { setDebouncedSearch(search); setPage(0); }}>검색</button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <span className={styles.countLabel}>전체 {totalElements}건</span>
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
              <th>입실일</th>
              <th>퇴실일</th>
              <th>상태</th>
              <th>설문</th>
              {admin && <th>삭제</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={admin ? 11 : 10} style={{ textAlign: 'center', color: 'var(--text-sub)', padding: '40px' }}>
                  불러오는 중...
                </td>
              </tr>
            ) : reservations.length === 0 ? (
              <tr>
                <td colSpan={admin ? 11 : 10} style={{ textAlign: 'center', color: 'var(--text-sub)', padding: '40px' }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              reservations.map((r) => (
                <tr key={r.id} onClick={() => openEdit(r)}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.reservationCode}</td>
                  <td>
                    <span className={styles.colorDot} style={{ backgroundColor: r.colorCode }} />
                    {r.organization}
                  </td>
                  <td>{r.purpose}</td>
                  <td>{r.people}명</td>
                  <td>{r.customer}</td>
                  <td>{r.customerPhone}</td>
                  <td>{String(r.startDate)}</td>
                  <td>{String(r.endDate)}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[r.status]}`}>{r.status}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      className={styles.surveyBtn}
                      onClick={() => setSurveyTarget(r)}
                    >
                      설문
                    </button>
                  </td>
                  {admin && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleHardDelete(r)}
                      >
                        삭제
                      </button>
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
          <button disabled={page === 0} onClick={() => setPage(0)}>{'«'}</button>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>{'‹'}</button>
          <span>{page + 1} / {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>{'›'}</button>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>{'»'}</button>
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

      {surveyTarget && (
        <SurveyModal
          reservationCode={surveyTarget.reservationCode}
          organization={surveyTarget.organization}
          onClose={() => setSurveyTarget(null)}
        />
      )}

      {confirmDialog && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p className={styles.confirmMsg}>{confirmDialog.message}</p>
            <div className={styles.confirmBtns}>
              <button className={styles.confirmCancelBtn} onClick={() => setConfirmDialog(null)}>취소</button>
              <button className={styles.confirmOkBtn} onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
