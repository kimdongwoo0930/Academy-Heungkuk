"use client";

import ReservationDetailModal from "@/components/dashboard/ReservationDetailModal";
import ReservationModal from "@/components/reservation/ReservationModal";
import MonthSwitcher from "@/components/scheduler/MonthSwitcher";
import WeekCard, { WeekDay, WeekRow } from "@/components/scheduler/WeekCard";
import RefreshStatus from "@/components/ui/RefreshStatus";
import { usePolling } from "@/hooks/usePolling";
import {
  getReservationsByYear,
  toRequestBody,
  updateReservation,
} from "@/lib/api/reservation";
import { isAdmin } from "@/lib/utils/auth";
import { printMealTable } from "@/lib/utils/printRoomTable";
import { Reservation } from "@/types/reservation";
import { isHoliday } from "@hyunbinseo/holidays-kr";
import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

function checkIsHoliday(date: Date): boolean {
  try {
    return isHoliday(date);
  } catch {
    return false;
  }
}

function makeDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MEAL_KEYS = ["breakfast", "lunch", "dinner"] as const;
const SPECIAL_KEYS = ["specialBreakfast", "specialLunch", "specialDinner"] as const;

export default function RestaurantPage() {
  const today = new Date();
  const todayStr = makeDateStr(today);

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  // 관리자가 아니면 수정 모달 대신 읽기 전용 상세를 보여준다
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // silent: true면 다른 사용자의 변경을 조용히 반영(폴링용) — 로딩 오버레이/알럿 없이
  const fetchReservations = (y: number, m: number, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const years = [y];
    if (m === 0) years.push(y - 1);
    if (m === 11) years.push(y + 1);
    if (!silent) setIsLoading(true);
    return Promise.all(years.map(getReservationsByYear))
      .then((results) => {
        const merged = [...new Map(results.flat().map((r) => [r.id, r])).values()];
        setReservations(merged);
      })
      .catch(() => {
        if (!silent) alert("예약 데이터를 불러오는데 실패했습니다.");
      })
      .finally(() => {
        if (!silent) setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchReservations(year, month);
  }, [year, month]);

  // 다른 사용자의 예약 변경을 반영 — 1분마다 조용히 재조회 + 탭 복귀 시 즉시 반영
  const { lastUpdated, refetchNow } = usePolling(
    () => fetchReservations(year, month, { silent: true }),
    60_000,
  );

  // ── 주 단위(월요일 시작, 7일씩) ──
  const weeks = useMemo<WeekDay[][]>(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const endOffset = (7 - lastDay.getDay()) % 7;
    const start = new Date(year, month, 1 - startOffset);
    const end = new Date(year, month + 1, endOffset);
    const days: WeekDay[] = [];
    for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const dow = cur.getDay();
      const dateStr = makeDateStr(cur);
      days.push({
        dateStr,
        month: cur.getMonth() + 1,
        day: cur.getDate(),
        dow,
        isCurrent: cur.getMonth() === month,
        isToday: dateStr === todayStr,
        // 평일 공휴일은 일요일과 동일 취급
        kind: dow === 6 ? "sat" : dow === 0 || checkIsHoliday(cur) ? "sun" : null,
      });
    }
    const result: WeekDay[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [year, month, todayStr]);

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  };

  const handleSave = async (data: Reservation) => {
    const body = toRequestBody(data);
    const updated = await updateReservation(data.id, body);
    setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const displayedDates = useMemo(() => new Set(weeks.flat().map((d) => d.dateStr)), [weeks]);

  const activeMealReservations = useMemo(
    () =>
      reservations.filter(
        (r) => r.status !== "취소" && r.meals?.some((m) => displayedDates.has(String(m.reservedDate))),
      ),
    [reservations, displayedDates],
  );

  const getMeal = (res: Reservation, dateStr: string) =>
    res.meals?.find((m) => String(m.reservedDate) === dateStr) ?? null;

  const buildCard = (days: WeekDay[]) => {
    const rows: WeekRow[] = [];
    for (const res of activeMealReservations) {
      const cells = days.map((d) => {
        const meal = getMeal(res, d.dateStr);
        return MEAL_KEYS.map((key, k) => {
          const value = meal?.[key] ?? 0;
          const special = meal?.[SPECIAL_KEYS[k]] ?? false;
          return {
            value,
            variant: special ? ("special" as const) : res.status === "확정" ? ("normal" as const) : ("pending" as const),
          };
        });
      });
      const total = cells.flat().reduce((s, c) => s + c.value, 0);
      if (total === 0) continue; // 이 주에 식수가 없는 단체는 숨김
      rows.push({
        key: res.id,
        org: res.organization,
        colorCode: res.colorCode,
        cells,
        total,
        onSelect: () => (isAdmin() ? setEditTarget(res) : setDetailTarget(res)),
      });
    }
    const dayTotals = days.map((_, i) =>
      [0, 1, 2].map((k) => rows.reduce((s, r) => s + r.cells[i][k].value, 0)),
    );
    const grandTotal = dayTotals.flat().reduce((s, v) => s + v, 0);
    return { rows, dayTotals, grandTotal };
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>식수 관리</h1>
          <p className={styles.pageDesc}>주차별 일별 식수 인원 (조식·중식·석식)</p>
        </div>
        <div className={styles.headRight}>
          <RefreshStatus lastUpdated={lastUpdated} onRefresh={refetchNow} />
          <MonthSwitcher
            year={year}
            month={month}
            onPrev={prevMonth}
            onNext={nextMonth}
            onJump={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => printMealTable(year, month, reservations)}
            aria-label="인쇄 / PDF"
            title="인쇄 / PDF"
          >
            <Printer size={16} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading} role="status">
          데이터를 가져오는 중...
        </div>
      ) : (
        weeks.map((days) => {
          const first = days[0];
          const last = days[days.length - 1];
          const { rows, dayTotals, grandTotal } = buildCard(days);
          return (
            <WeekCard
              key={first.dateStr}
              title={`${first.month}/${first.day} ~ ${last.month}/${last.day}`}
              days={days}
              subLabels={["조", "중", "석"]}
              rows={rows}
              dayTotals={dayTotals}
              grandTotal={grandTotal}
              totalHeader="합계"
              emptyText="이 주에는 식수 예약이 없습니다."
            />
          );
        })
      )}

      {detailTarget && (
        <ReservationDetailModal
          reservation={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {editTarget && (
        <ReservationModal
          reservation={editTarget}
          allReservations={reservations}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
