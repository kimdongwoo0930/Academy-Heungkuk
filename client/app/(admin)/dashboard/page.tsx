"use client";

import DashboardListModal from "@/components/dashboard/DashboardListModal";
import KpiCard from "@/components/dashboard/KpiCard";
import MonthlyChart from "@/components/dashboard/MonthlyChart";
import RecentSurveyTable from "@/components/dashboard/RecentSurveyTable";
import RoomStatus from "@/components/dashboard/RoomStatus";
import SatisfactionBar from "@/components/dashboard/SatisfactionBar";
import TodaySchedule from "@/components/dashboard/TodaySchedule";
import ReservationModal from "@/components/reservation/ReservationModal";
import { getDashboard } from "@/lib/api/dashboard";
import {
  getReservationById,
  getReservationsByRange,
  getReservationsByYear,
  toRequestBody,
  updateReservation,
} from "@/lib/api/reservation";
import { getDisabledClassrooms } from "@/lib/api/settings";
import { DashboardData } from "@/types/dashboard";
import { Reservation } from "@/types/reservation";
import { useCallback, useEffect, useState } from "react";
import styles from "./page.module.css";

interface ListModal {
  title: string;
  items: Reservation[];
}

interface EditModal {
  reservation: Reservation;
  allReservations: Reservation[];
}

const isActiveReservation = (reservation: Reservation) =>
  reservation.status !== "취소";

export default function DashboardPage() {
  const today = new Date();
  const dateStr = today.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const todayStr = today.toISOString().slice(0, 10);

  const [data, setData] = useState<DashboardData | null>(null);
  const [disabledClassrooms, setDisabledClassrooms] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [listModal, setListModal] = useState<ListModal | null>(null);
  const [editModal, setEditModal] = useState<EditModal | null>(null);

  useEffect(() => {
    getDashboard().then(setData).catch(console.error);
    getDisabledClassrooms().then(setDisabledClassrooms).catch(() => {});
  }, []);

  const openEditById = useCallback(async (reservationId: number) => {
    setFetching(true);
    try {
      const res = await getReservationById(reservationId);
      const years = [
        ...new Set([
          new Date(res.startDate).getFullYear(),
          new Date(res.endDate).getFullYear(),
        ]),
      ];
      const all = (await Promise.all(years.map(getReservationsByYear))).flat();
      setListModal(null);
      setEditModal({ reservation: res, allReservations: all });
    } finally {
      setFetching(false);
    }
  }, []);

  const openMonthlyList = useCallback(async () => {
    setFetching(true);
    try {
      const first = `${todayStr.slice(0, 7)}-01`;
      const last = new Date(
        Number(todayStr.slice(0, 4)),
        Number(todayStr.slice(5, 7)),
        0,
      )
        .toISOString()
        .slice(0, 10);
      const items = await getReservationsByRange(first, last);
      setListModal({
        title: "이번 달 이용 업체",
        items: items.filter(isActiveReservation),
      });
    } finally {
      setFetching(false);
    }
  }, [todayStr]);


  const handleSave = useCallback(
    async (saved: Reservation) => {
      if (!editModal) return;
      await updateReservation(editModal.reservation.id, toRequestBody(saved));
      setEditModal(null);
      getDashboard().then(setData).catch(console.error);
    },
    [editModal],
  );

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHead}>
          <span className={styles.pageTitle}>대시보드</span>
          <div className={styles.dateBadge}>
            오늘 <span>{dateStr}</span>
          </div>
        </div>
        <div className={styles.loading}>데이터를 불러오는 중...</div>
      </div>
    );
  }

  const { kpi, todayClassrooms, monthlyData, satisfaction, recentSurveys } =
    data;
  const change = kpi.monthlyChange;
  const todayOrgCount = new Set(todayClassrooms.map((c) => c.organization))
    .size;
  const todayTotalPeople = Array.from(
    new Map(todayClassrooms.map((c) => [c.organization, c.people])).values(),
  ).reduce((sum, p) => sum + p, 0);

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <span className={styles.pageTitle}>대시보드</span>
        <div className={styles.dateBadge}>
          오늘 <span>{dateStr}</span>
        </div>
      </div>

      {/* KPI 카드 3개 */}
      <div className={styles.kpiGrid}>
        <KpiCard
          label="이번 달 이용 업체"
          value={kpi.monthlyReservations}
          icon="📋"
          variant="pink"
          animDelay="0.05s"
          onClick={openMonthlyList}
          subText={
            <>
              전월 대비{" "}
              <span className={change >= 0 ? styles.up : styles.down}>
                {change >= 0 ? `↑ +${change}건` : `↓ ${change}건`}
              </span>
            </>
          }
        />
        <KpiCard
          label="금일 이용 업체"
          value={todayOrgCount}
          icon="🏨"
          variant="green"
          animDelay="0.10s"

          subText={
            <>
              총 <span className={styles.greenText}>{todayTotalPeople}명</span>{" "}
              이용 예정
            </>
          }
        />
        <KpiCard
          label="설문 만족도"
          value={kpi.surveyScore}
          icon="⭐"
          variant="yellow"
          animDelay="0.15s"
          subText={<>{kpi.surveyCount}건 응답 평균</>}
        />
      </div>

      {/* 금일 사용 단체(1fr) + 월별 추이(2fr) */}
      <div className={styles.row3}>
        <TodaySchedule
          todayClassrooms={todayClassrooms}
          onItemClick={openEditById}
        />
        <MonthlyChart
          monthlyData={monthlyData}
          year={today.getFullYear()}
          currentMonth={today.getMonth() + 1}
        />
      </div>

      {/* 강의실 현황 + 설문 만족도 */}
      <div className={styles.row2}>
        <RoomStatus
          todayClassrooms={todayClassrooms}
          disabledClassrooms={disabledClassrooms}
          onItemClick={openEditById}
        />
        <SatisfactionBar satisfaction={satisfaction} />
      </div>

      {/* 최근 설문 내역 */}
      <RecentSurveyTable recentSurveys={recentSurveys} />

      {/* 목록 모달 */}
      {listModal && (
        <DashboardListModal
          title={listModal.title}
          items={listModal.items}
          onSelect={(r) => openEditById(r.id)}
          onClose={() => setListModal(null)}
        />
      )}

      {/* 예약 편집 모달 */}
      {editModal && (
        <ReservationModal
          reservation={editModal.reservation}
          allReservations={editModal.allReservations}
          onClose={() => setEditModal(null)}
          onSave={handleSave}
        />
      )}

      {/* 로딩 오버레이 */}
      {fetching && (
        <div className={styles.fetchingOverlay}>
          <div className={styles.fetchingBox}>
            <div className={styles.spinner} />
            <span className={styles.fetchingText}>로딩 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}
