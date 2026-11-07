"use client";

import ReservationDetailModal from "@/components/dashboard/ReservationDetailModal";
import ReservationModal from "@/components/reservation/ReservationModal";
import RoomPickerModal from "@/components/reservation/RoomPickerModal";
import MonthSwitcher from "@/components/scheduler/MonthSwitcher";
import WeekCard, { WeekDay, WeekRow } from "@/components/scheduler/WeekCard";
import RefreshStatus from "@/components/ui/RefreshStatus";
import { usePolling } from "@/hooks/usePolling";
import {
  createReservation,
  getReservationsByYear,
  toRequestBody,
  updateReservation,
} from "@/lib/api/reservation";
import { ROOM_TYPES } from "@/lib/constants/rooms";
import { STATUS_COLOR } from "@/lib/constants/status";
import { isAdmin } from "@/lib/utils/auth";
import { printAccommodationTable } from "@/lib/utils/printRoomTable";
import { Reservation, RoomReservation } from "@/types/reservation";
import { isHoliday } from "@hyunbinseo/holidays-kr";
import { Printer } from "lucide-react";
import { MouseEvent, useEffect, useMemo, useState } from "react";
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

interface TooltipState {
  res: Reservation;
  rooms: RoomReservation[];
  x: number;
  y: number;
}

export default function AccommodationPage() {
  const today = new Date();
  const todayStr = makeDateStr(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  // 관리자가 아니면 수정 모달 대신 읽기 전용 상세를 보여준다
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null);
  const [dateView, setDateView] = useState<string | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
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

  const displayedDates = useMemo(() => new Set(weeks.flat().map((d) => d.dateStr)), [weeks]);

  const activeRoomReservations = useMemo(
    () =>
      reservations.filter(
        (r) => r.status !== "취소" && r.rooms?.some((rm) => displayedDates.has(String(rm.reservedDate))),
      ),
    [reservations, displayedDates],
  );

  const getRoomsOnDate = (res: Reservation, dateStr: string): RoomReservation[] =>
    (res.rooms ?? []).filter((rm) => String(rm.reservedDate) === dateStr);

  // ── 날짜별 현황 (객실 배정 보기 모달용) ──
  const getOccupiedRoomsOnDate = (dateStr: string): string[] =>
    activeRoomReservations.flatMap((res) => getRoomsOnDate(res, dateStr).map((rm) => rm.roomNumber));

  const getRoomColorsOnDate = (dateStr: string): Record<string, string> => {
    const colorMap: Record<string, string> = {};
    activeRoomReservations.forEach((res) => {
      getRoomsOnDate(res, dateStr).forEach((rm) => {
        colorMap[rm.roomNumber] = res.colorCode;
      });
    });
    return colorMap;
  };

  const getOrgLegendOnDate = (dateStr: string): { color: string; organization: string }[] => {
    const seen = new Set<string>();
    const result: { color: string; organization: string }[] = [];
    activeRoomReservations.forEach((res) => {
      if (getRoomsOnDate(res, dateStr).length > 0 && !seen.has(res.colorCode)) {
        seen.add(res.colorCode);
        result.push({ color: res.colorCode, organization: res.organization });
      }
    });
    return result;
  };

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

  const handleCreate = async (data: Reservation) => {
    const body = toRequestBody(data);
    const created = await createReservation(body);
    setReservations((prev) => [...prev, created]);
  };

  const handleSave = async (data: Reservation) => {
    const body = toRequestBody(data);
    const updated = await updateReservation(data.id, body);
    setReservations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const showTooltip = (e: MouseEvent, res: Reservation, rooms: RoomReservation[]) => {
    const tooltipW = 220;
    const tooltipH = 160;
    const x = e.clientX + 14 + tooltipW > window.innerWidth ? e.clientX - tooltipW - 8 : e.clientX + 14;
    const y = e.clientY + 14 + tooltipH > window.innerHeight ? e.clientY - tooltipH - 8 : e.clientY + 14;
    setTooltip({ res, rooms, x, y });
  };

  const buildCard = (days: WeekDay[]) => {
    const rows: WeekRow[] = [];
    for (const res of activeRoomReservations) {
      const cells = days.map((d) => {
        const rooms = getRoomsOnDate(res, d.dateStr);
        return ROOM_TYPES.map((type) => ({
          value: rooms.filter((rm) => rm.roomType === type).length,
          variant: res.status === "확정" ? ("normal" as const) : ("pending" as const),
        }));
      });
      const total = cells.flat().reduce((s, c) => s + c.value, 0);
      if (total === 0) continue; // 이 주에 숙박이 없는 단체는 숨김
      rows.push({
        key: res.id,
        org: res.organization,
        colorCode: res.colorCode,
        cells,
        total,
        onSelect: () => (isAdmin() ? setEditTarget(res) : setDetailTarget(res)),
        onCellHover: (e, i) => {
          const rooms = getRoomsOnDate(res, days[i].dateStr);
          if (rooms.length > 0) showTooltip(e, res, rooms);
          else setTooltip(null);
        },
        onCellLeave: () => setTooltip(null),
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
          <h1 className={styles.pageTitle}>숙박 현황</h1>
          <p className={styles.pageDesc}>주차별 객실 예약 현황 (객실 수 기준 · 4인실 / 2인실 / 1인실)</p>
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
            onClick={() => printAccommodationTable(year, month, reservations)}
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
              subLabels={["4인", "2인", "1인"]}
              rows={rows}
              dayTotals={dayTotals}
              grandTotal={grandTotal}
              totalHeader="합계"
              emptyText="이 주에는 숙박 예약이 없습니다."
              onDayClick={(d) => setDateView(d.dateStr)}
              onDayDoubleClick={(d) => {
                if (!isAdmin()) return;
                const end = new Date(d.dateStr);
                end.setDate(end.getDate() + 2);
                setCreateDate(d.dateStr + "/" + makeDateStr(end));
              }}
            />
          );
        })
      )}

      {/* 호버 툴팁 */}
      {tooltip && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipOrg}>{tooltip.res.organization}</span>
            <span className={styles.tooltipBadge} style={{ color: STATUS_COLOR[tooltip.res.status] ?? "#555" }}>
              {tooltip.res.status}
            </span>
          </div>
          <div className={styles.tooltipDivider} />
          <div className={styles.tooltipInfo}>
            <span className={styles.tooltipKey}>기간</span>
            <span>
              {tooltip.res.startDate} ~ {tooltip.res.endDate}
            </span>
          </div>
          <div className={styles.tooltipInfo}>
            <span className={styles.tooltipKey}>인원</span>
            <span>{tooltip.res.people}인</span>
            {tooltip.res.purpose && (
              <>
                <span className={styles.tooltipSep}>·</span>
                <span>{tooltip.res.purpose}</span>
              </>
            )}
          </div>
          <div className={styles.tooltipInfo}>
            <span className={styles.tooltipKey}>담당</span>
            <span>{tooltip.res.customer}</span>
            <span className={styles.tooltipSep}>·</span>
            <span>{tooltip.res.customerPhone}</span>
          </div>
          {ROOM_TYPES.map((type) => {
            const typeRooms = tooltip.rooms.filter((r) => r.roomType === type);
            return typeRooms.length > 0 ? (
              <div key={type} className={styles.tooltipInfo}>
                <span className={styles.tooltipKey}>{type}</span>
                <span>{typeRooms.map((r) => r.roomNumber + "호").join(", ")}</span>
              </div>
            ) : null;
          })}
        </div>
      )}

      {dateView && (
        <RoomPickerModal
          date={dateView}
          selected={[]}
          occupiedRooms={getOccupiedRoomsOnDate(dateView)}
          roomColors={getRoomColorsOnDate(dateView)}
          orgLegend={getOrgLegendOnDate(dateView)}
          onConfirm={() => {}}
          onClose={() => setDateView(null)}
          viewOnly
        />
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

      {createDate &&
        (() => {
          const [start, end] = createDate.split("/");
          return (
            <ReservationModal
              reservation={null}
              allReservations={reservations}
              onClose={() => setCreateDate(null)}
              onSave={handleCreate}
              defaultValues={{ startDate: start, endDate: end }}
            />
          );
        })()}
    </div>
  );
}
