"use client";

import KpiCard from "@/components/dashboard/KpiCard";
import RoomStatus from "@/components/dashboard/RoomStatus";
import SatisfactionSummary from "@/components/dashboard/SatisfactionSummary";
import TodayLodging from "@/components/dashboard/TodayLodging";
import TodayMeals from "@/components/dashboard/TodayMeals";
import UpcomingWeek from "@/components/dashboard/UpcomingWeek";
import ReservationDetailModal from "@/components/dashboard/ReservationDetailModal";
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
import { isAdmin } from "@/lib/utils/auth";
import {
  addDays,
  buildUpcomingDays,
  countUpcomingBookings,
  formatMonthDay,
  parseDateStr,
  summarizeTodayLodging,
  summarizeTodayMeals,
  toDateStr,
} from "@/lib/utils/dashboard";
import { DashboardData } from "@/types/dashboard";
import { Reservation } from "@/types/reservation";
import { CalendarClock, Star, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

interface EditModal {
  reservation: Reservation;
  allReservations: Reservation[];
  initialTab?: "숙박";
}

interface DetailModal {
  reservation: Reservation;
}

const UPCOMING_DAYS = 7;

export default function DashboardPage() {
  const today = useMemo(() => new Date(), []);
  const todayStr = toDateStr(today);
  const rangeEndStr = toDateStr(addDays(today, UPCOMING_DAYS - 1));

  const dateStr = today.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const [data, setData] = useState<DashboardData | null>(null);
  // 오늘 ~ 6일 뒤(총 7일)까지 걸치는 예약 (다가오는 일정 / 오늘 숙박 / 오늘 식사 공용)
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [disabledClassrooms, setDisabledClassrooms] = useState<string[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  // 일반 사용자에게는 수정이 아닌 읽기 전용 상세를 보여준다
  const [detail, setDetail] = useState<DetailModal | null>(null);

  const load = useCallback(() => {
    return Promise.all([
      getDashboard(),
      getReservationsByRange(todayStr, rangeEndStr),
      getDisabledClassrooms().catch(() => [] as string[]),
    ])
      .then(([dashboard, range, disabled]) => {
        setData(dashboard);
        setReservations(range);
        setDisabledClassrooms(disabled);
        setLoadFailed(false);
      })
      .catch((e) => {
        console.error(e);
        setLoadFailed(true);
      });
  }, [todayStr, rangeEndStr]);

  useEffect(() => {
    load();
  }, [load]);

  // tab 을 주면 그 영역(숙박)부터 보여준다
  const openEditById = useCallback(async (reservationId: number, tab?: "숙박") => {
    setFetching(true);
    try {
      const res = await getReservationById(reservationId);
      if (!isAdmin()) {
        setDetail({ reservation: res });
        return;
      }
      const years = [
        ...new Set([
          new Date(res.startDate).getFullYear(),
          new Date(res.endDate).getFullYear(),
        ]),
      ];
      const all = (await Promise.all(years.map(getReservationsByYear))).flat();
      setEditModal({ reservation: res, allReservations: all, initialTab: tab });
    } finally {
      setFetching(false);
    }
  }, []);

  const handleSave = useCallback(
    async (saved: Reservation) => {
      if (!editModal) return;
      await updateReservation(editModal.reservation.id, toRequestBody(saved));
      setEditModal(null);
      load();
    },
    [editModal, load],
  );

  const upcomingDays = useMemo(
    () => buildUpcomingDays(reservations, parseDateStr(todayStr), UPCOMING_DAYS),
    [reservations, todayStr],
  );
  const lodgingToday = useMemo(
    () => summarizeTodayLodging(reservations, todayStr),
    [reservations, todayStr],
  );
  const mealsToday = useMemo(
    () => summarizeTodayMeals(reservations, todayStr),
    [reservations, todayStr],
  );

  const header = (
    <div className={styles.pageHead}>
      <div>
        <h1 className={styles.pageTitle}>대시보드</h1>
        <p className={styles.pageDesc}>
          오늘의 이용 현황과 다가오는 일정을 한눈에 확인하세요.
        </p>
      </div>
      <div className={styles.dateBadge}>
        오늘 <strong>{dateStr}</strong>
      </div>
    </div>
  );

  if (!data) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.statusMsg} role="status">
          {loadFailed
            ? "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
            : "데이터를 불러오는 중..."}
        </div>
      </div>
    );
  }

  const { kpi, todayClassrooms, satisfaction } = data;
  const todayOrgCount = new Set(todayClassrooms.map((c) => c.organization))
    .size;
  const todayTotalPeople = Array.from(
    new Map(todayClassrooms.map((c) => [c.organization, c.people])).values(),
  ).reduce((sum, p) => sum + p, 0);

  return (
    <div className={styles.page}>
      {header}

      <div className={styles.kpiGrid}>
        <KpiCard
          label="금일 이용 업체"
          value={todayOrgCount}
          unit="곳"
          Icon={Users}
          tone="green"
          sub={
            <>
              총 <strong>{todayTotalPeople}명</strong> 이용 예정
            </>
          }
        />
        <KpiCard
          label="다음 7일 예정"
          value={countUpcomingBookings(upcomingDays)}
          unit="건"
          Icon={CalendarClock}
          tone="accent"
          sub={`${formatMonthDay(upcomingDays[0].date)} ~ ${formatMonthDay(upcomingDays[UPCOMING_DAYS - 1].date)} 대관 기준`}
        />
        <KpiCard
          label="설문 만족도"
          value={kpi.surveyScore > 0 ? kpi.surveyScore.toFixed(1) : "-"}
          unit="/ 5.0"
          Icon={Star}
          tone="warn"
          sub={`${kpi.surveyCount}건 응답 평균`}
        />
      </div>

      <UpcomingWeek days={upcomingDays} onSelectBooking={openEditById} />

      <div className={styles.bottomGrid}>
        <RoomStatus
          todayClassrooms={todayClassrooms}
          disabledClassrooms={disabledClassrooms}
          onItemClick={openEditById}
        />
        <div className={styles.stack}>
          <TodayLodging
            groups={lodgingToday.groups}
            lodging={lodgingToday.lodging}
            onSelect={(id) => openEditById(id, "숙박")}
          />
          <TodayMeals meals={mealsToday} />
        </div>
      </div>

      <SatisfactionSummary satisfaction={satisfaction} />

      {editModal && (
        <ReservationModal
          reservation={editModal.reservation}
          allReservations={editModal.allReservations}
          initialTab={editModal.initialTab}
          onClose={() => setEditModal(null)}
          onSave={handleSave}
        />
      )}

      {detail && (
        <ReservationDetailModal
          reservation={detail.reservation}
          onClose={() => setDetail(null)}
        />
      )}

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
