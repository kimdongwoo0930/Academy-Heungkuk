"use client";

import ReservationModal from "@/components/reservation/ReservationModal";
import RoomPickerModal from "@/components/reservation/RoomPickerModal";
import MonthNavigator from "@/components/ui/MonthNavigator";
import RefreshStatus from "@/components/ui/RefreshStatus";
import { usePolling } from "@/hooks/usePolling";
import {
  createReservation,
  getReservationsByYear,
  toRequestBody,
  updateReservation,
} from "@/lib/api/reservation";
import { ROOM_TYPES, RoomType } from "@/lib/constants/rooms";
import { STATUS_COLOR } from "@/lib/constants/status";
import { printAccommodationTable } from "@/lib/utils/printRoomTable";
import { Reservation, RoomReservation } from "@/types/reservation";
import { isHoliday } from "@hyunbinseo/holidays-kr";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

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

interface CalDay {
  date: Date;
  dateStr: string;
  isCurrent: boolean;
}

interface TooltipState {
  res: Reservation;
  rooms: RoomReservation[];
  x: number;
  y: number;
}

const ORG_COL = 80;
const DATE_COL = 18; // 타입별 서브컬럼 하나당 너비
const TOTAL_COL = 44;

export default function AccommodationPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  const [dateView, setDateView] = useState<string | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // silent: true면 다른 사용자의 변경을 조용히 반영(폴링용) — 로딩 오버레이/알럿 없이
  const fetchReservations = (y: number, m: number, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const years = [y];
    if (m === 0) years.push(y - 1);
    if (m === 11) years.push(y + 1);
    if (!silent) setIsLoading(true);
    return Promise.all(years.map(getReservationsByYear))
      .then((results) => {
        const merged = [
          ...new Map(results.flat().map((r) => [r.id, r])).values(),
        ];
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

  // year/month가 바뀔 때만 달력 날짜 배열 재생성
  const calDays = useMemo<CalDay[]>(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startOffset);
    const endOffset = (7 - lastDay.getDay()) % 7;
    const endDate = new Date(year, month + 1, endOffset);
    const days: CalDay[] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const d = new Date(cur);
      days.push({ date: d, dateStr: makeDateStr(d), isCurrent: d.getMonth() === month });
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }, [year, month]);

  const halves = useMemo<CalDay[][]>(() => {
    const result: CalDay[][] = [];
    for (let i = 0; i < calDays.length; i += 7)
      result.push(calDays.slice(i, i + 7));
    return result;
  }, [calDays]);

  const displayedDates = useMemo(
    () => new Set(calDays.map((c) => c.dateStr)),
    [calDays],
  );

  // checkIsHoliday 호출이 비싸므로 Set으로 미리 계산
  const redDaySet = useMemo(
    () => new Set(
      calDays
        .filter((c) => c.date.getDay() === 0 || c.date.getDay() === 6 || checkIsHoliday(c.date))
        .map((c) => c.dateStr),
    ),
    [calDays],
  );

  const activeRoomReservations = useMemo(
    () => reservations.filter((r) => {
      if (r.status === "취소") return false;
      return r.rooms?.some((rm) => displayedDates.has(String(rm.reservedDate)));
    }),
    [reservations, displayedDates],
  );

  // resId → 날짜별 객실 목록 맵 (O(n) find → O(1) 조회)
  const roomsByResId = useMemo(
    () => new Map(reservations.map((r) => [r.id, r.rooms ?? []])),
    [reservations],
  );

  const getRoomsOnDate = (resId: number, dateStr: string): RoomReservation[] =>
    (roomsByResId.get(resId) ?? []).filter((rm) => String(rm.reservedDate) === dateStr);

  const getDayTypeTotal = (dateStr: string, type: RoomType) => {
    let total = 0;
    activeRoomReservations.forEach((r) => {
      total += getRoomsOnDate(r.id, dateStr).filter(
        (rm) => rm.roomType === type,
      ).length;
    });
    return total;
  };

  const getOccupiedRoomsOnDate = (dateStr: string): string[] => {
    const rooms: string[] = [];
    activeRoomReservations.forEach((res) => {
      getRoomsOnDate(res.id, dateStr).forEach((rm) =>
        rooms.push(rm.roomNumber),
      );
    });
    return rooms;
  };

  const getRoomColorsOnDate = (dateStr: string): Record<string, string> => {
    const colorMap: Record<string, string> = {};
    activeRoomReservations.forEach((res) => {
      getRoomsOnDate(res.id, dateStr).forEach((rm) => {
        colorMap[rm.roomNumber] = res.colorCode;
      });
    });
    return colorMap;
  };

  const getOrgLegendOnDate = (
    dateStr: string,
  ): { color: string; organization: string }[] => {
    const seen = new Set<string>();
    const result: { color: string; organization: string }[] = [];
    activeRoomReservations.forEach((res) => {
      if (
        getRoomsOnDate(res.id, dateStr).length > 0 &&
        !seen.has(res.colorCode)
      ) {
        seen.add(res.colorCode);
        result.push({ color: res.colorCode, organization: res.organization });
      }
    });
    return result;
  };

  const getDayTotal = (dateStr: string) =>
    ROOM_TYPES.reduce((s, t) => s + getDayTypeTotal(dateStr, t), 0);

  const monthDates = calDays.filter((c) => c.isCurrent);
  const month4 = monthDates.reduce(
    (s, c) => s + getDayTypeTotal(c.dateStr, "4인실"),
    0,
  );
  const month2 = monthDates.reduce(
    (s, c) => s + getDayTypeTotal(c.dateStr, "2인실"),
    0,
  );
  const month1 = monthDates.reduce(
    (s, c) => s + getDayTypeTotal(c.dateStr, "1인실"),
    0,
  );
  const monthTotal = month4 + month2 + month1;
  const firstDate = monthDates[0]?.dateStr ?? "";
  const lastDate = monthDates[monthDates.length - 1]?.dateStr ?? "";
  const monthRoomReservations = activeRoomReservations.filter((res) =>
    monthDates.some((cal) => getRoomsOnDate(res.id, cal.dateStr).length > 0),
  );
  const isRedDay = (cal: CalDay) => redDaySet.has(cal.dateStr);

  const thCls = (cal: CalDay) => {
    if (!cal.isCurrent) return styles.otherMonthTh;
    if (isRedDay(cal)) return styles.weekendTh;
    return "";
  };
  const tdCls = (cal: CalDay) => {
    if (!cal.isCurrent) return styles.otherMonthCol;
    if (isRedDay(cal)) return styles.weekendCol;
    return "";
  };
  const roomCellTdCls = (cal: CalDay, count: number) => {
    if (!cal.isCurrent) return styles.otherMonthCol;
    if (isRedDay(cal)) {
      return count > 0 ? styles.weekendCellHasValue : styles.weekendCol;
    }
    return count > 0 ? styles.roomCellHasValue : "";
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

  const handleMouseMove = (
    e: React.MouseEvent,
    res: Reservation,
    rooms: RoomReservation[],
  ) => {
    const tooltipW = 220;
    const tooltipH = 160;
    const x =
      e.clientX + 14 + tooltipW > window.innerWidth
        ? e.clientX - tooltipW - 8
        : e.clientX + 14;
    const y =
      e.clientY + 14 + tooltipH > window.innerHeight
        ? e.clientY - tooltipH - 8
        : e.clientY + 14;
    setTooltip({ res, rooms, x, y });
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.pageIntro}>
          <span className={styles.eyebrow}>Accommodation</span>
          <h1 className={styles.title}>숙박 현황</h1>
          <p>{firstDate} ~ {lastDate} 기준 객실 예약 현황입니다.</p>
        </div>
        <div className={styles.headerControls}>
          <button
            className={styles.printBtn}
            onClick={() => printAccommodationTable(year, month, reservations)}
          >
            🖨 인쇄 / PDF
          </button>
          <RefreshStatus lastUpdated={lastUpdated} onRefresh={refetchNow} />
          <MonthNavigator
            year={year}
            month={month}
            onPrev={prevMonth}
            onNext={nextMonth}
            onJump={(y, m) => { setYear(y); setMonth(m); }}
          />
        </div>
      </div>

      {!isLoading && (
        <section className={styles.summaryGrid}>
          <div className={styles.summaryHero}>
            <span className={styles.summaryLabel}>월 객실 합계</span>
            <strong>{monthTotal.toLocaleString()}</strong>
            <span className={styles.summaryHint}>
              4인실 {month4.toLocaleString()} · 2인실 {month2.toLocaleString()} · 1인실 {month1.toLocaleString()}
            </span>
          </div>
          <div className={styles.summaryCard}>
            <span className={styles.summaryLabel}>이용 단체</span>
            <strong>{monthRoomReservations.length.toLocaleString()}</strong>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className={styles.loading}>
          데이터를 가져오는 중...
        </div>
      ) : (
        halves.map((halfDays, hi) => {
          const tableW = ORG_COL + halfDays.length * DATE_COL * 3 + TOTAL_COL;
          const halfActiveRes = activeRoomReservations.filter((res) =>
            halfDays.some(
              (cal) => getRoomsOnDate(res.id, cal.dateStr).length > 0,
            ),
          );

          return (
            <div key={hi} className={styles.halfBlock}>
              <div className={styles.tableWrap}>
                <div style={{ minWidth: tableW, width: "100%" }}>
                  <table
                    className={styles.table}
                    style={{ minWidth: tableW, width: "100%" }}
                  >
                    <colgroup>
                      <col style={{ width: `${ORG_COL}px` }} />
                      {halfDays.flatMap((cal) => [
                        <col
                          key={`${cal.dateStr}4`}
                          style={{ width: `${DATE_COL}px` }}
                        />,
                        <col
                          key={`${cal.dateStr}2`}
                          style={{ width: `${DATE_COL}px` }}
                        />,
                        <col
                          key={`${cal.dateStr}1`}
                          style={{ width: `${DATE_COL}px` }}
                        />,
                      ])}
                      <col style={{ width: `${TOTAL_COL}px` }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th rowSpan={2} className={styles.thOrg}>
                          단체명
                        </th>
                        {halfDays.map((cal) => (
                          <th
                            key={cal.dateStr}
                            colSpan={3}
                            className={thCls(cal)}
                            style={{
                              cursor: cal.isCurrent ? "pointer" : undefined,
                            }}
                            onClick={() =>
                              cal.isCurrent && setDateView(cal.dateStr)
                            }
                            onDoubleClick={() => {
                              if (!cal.isCurrent) return;
                              const end = new Date(cal.date);
                              end.setDate(end.getDate() + 2);
                              setCreateDate(
                                cal.dateStr + "/" + makeDateStr(end),
                              );
                            }}
                          >
                            <div className={styles.dateNum}>
                              {cal.date.getDate()}일
                            </div>
                            <div className={styles.dayLabel}>
                              {WEEK_DAYS[cal.date.getDay()]}
                            </div>
                          </th>
                        ))}
                        <th rowSpan={2} className={styles.thTotal}>
                          합계
                        </th>
                      </tr>
                      <tr>
                        {halfDays.flatMap((cal) => [
                          <th
                            key={`${cal.dateStr}4`}
                            className={`${styles.roomSubTh} ${thCls(cal)}`}
                          >
                            4인
                          </th>,
                          <th
                            key={`${cal.dateStr}2`}
                            className={`${styles.roomSubTh} ${thCls(cal)}`}
                          >
                            2인
                          </th>,
                          <th
                            key={`${cal.dateStr}1`}
                            className={`${styles.roomSubTh} ${thCls(cal)}`}
                          >
                            1인
                          </th>,
                        ])}
                      </tr>
                    </thead>
                    <tbody>
                      {halfActiveRes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={1 + halfDays.length * 3 + 1}
                            className={styles.emptyCell}
                          >
                            이번 달 숙박 예약이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        halfActiveRes.map((res) => {
                          const halfTotal = halfDays.reduce(
                            (sum, cal) =>
                              sum + getRoomsOnDate(res.id, cal.dateStr).length,
                            0,
                          );
                          const cls =
                            res.status === "확정"
                              ? styles.confirmed
                              : styles.pending;
                          return (
                            <tr key={res.id}>
                              <td
                                className={styles.tdOrg}
                                style={{
                                  boxShadow: `inset 4px 0 0 0 ${res.colorCode}`,
                                  borderRadius: "4px 0 0 4px",
                                  cursor: "pointer",
                                }}
                                onClick={() => setEditTarget(res)}
                              >
                                {res.organization}
                              </td>
                              {halfDays.flatMap((cal) => {
                                const rooms = getRoomsOnDate(
                                  res.id,
                                  cal.dateStr,
                                );
                                const c4 = rooms.filter(
                                  (r) => r.roomType === "4인실",
                                ).length;
                                const c2 = rooms.filter(
                                  (r) => r.roomType === "2인실",
                                ).length;
                                const c1 = rooms.filter(
                                  (r) => r.roomType === "1인실",
                                ).length;
                                const hasAny = rooms.length > 0;
                                return [
                                  <td
                                    key={`${cal.dateStr}4`}
                                    className={`${styles.roomCell} ${roomCellTdCls(cal, c4)}`}
                                    onMouseEnter={(e) =>
                                      hasAny && handleMouseMove(e, res, rooms)
                                    }
                                    onMouseMove={(e) =>
                                      hasAny && handleMouseMove(e, res, rooms)
                                    }
                                    onMouseLeave={() => setTooltip(null)}
                                  >
                                    {c4 > 0 ? (
                                      <span className={cls}>{c4}</span>
                                    ) : (
                                      ""
                                    )}
                                  </td>,
                                  <td
                                    key={`${cal.dateStr}2`}
                                    className={`${styles.roomCell} ${roomCellTdCls(cal, c2)}`}
                                    onMouseEnter={(e) =>
                                      hasAny && handleMouseMove(e, res, rooms)
                                    }
                                    onMouseMove={(e) =>
                                      hasAny && handleMouseMove(e, res, rooms)
                                    }
                                    onMouseLeave={() => setTooltip(null)}
                                  >
                                    {c2 > 0 ? (
                                      <span className={cls}>{c2}</span>
                                    ) : (
                                      ""
                                    )}
                                  </td>,
                                  <td
                                    key={`${cal.dateStr}1`}
                                    className={`${styles.roomCell} ${roomCellTdCls(cal, c1)}`}
                                    onMouseEnter={(e) =>
                                      hasAny && handleMouseMove(e, res, rooms)
                                    }
                                    onMouseMove={(e) =>
                                      hasAny && handleMouseMove(e, res, rooms)
                                    }
                                    onMouseLeave={() => setTooltip(null)}
                                  >
                                    {c1 > 0 ? (
                                      <span className={cls}>{c1}</span>
                                    ) : (
                                      ""
                                    )}
                                  </td>,
                                ];
                              })}
                              <td className={styles.weekTotalCell}>
                                {halfTotal > 0 ? halfTotal : ""}
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {halfActiveRes.length > 0 &&
                        (() => {
                          const grandTotal = halfDays.reduce(
                            (s, cal) => s + getDayTotal(cal.dateStr),
                            0,
                          );
                          return (
                            <tr key="total" className={styles.totalRow}>
                              <td className={styles.totalLabel}>합계</td>
                              {halfDays.flatMap((cal) => {
                                const t4 = getDayTypeTotal(
                                  cal.dateStr,
                                  "4인실",
                                );
                                const t2 = getDayTypeTotal(
                                  cal.dateStr,
                                  "2인실",
                                );
                                const t1 = getDayTypeTotal(
                                  cal.dateStr,
                                  "1인실",
                                );
                                return [
                                  <td
                                    key={`${cal.dateStr}4`}
                                    className={tdCls(cal)}
                                  >
                                    {t4 > 0 ? t4 : ""}
                                  </td>,
                                  <td
                                    key={`${cal.dateStr}2`}
                                    className={tdCls(cal)}
                                  >
                                    {t2 > 0 ? t2 : ""}
                                  </td>,
                                  <td
                                    key={`${cal.dateStr}1`}
                                    className={tdCls(cal)}
                                  >
                                    {t1 > 0 ? t1 : ""}
                                  </td>,
                                ];
                              })}
                              <td className={styles.weekTotalCell}>
                                {grandTotal > 0 ? grandTotal : ""}
                              </td>
                            </tr>
                          );
                        })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })
      )}


      {/* 호버 툴팁 */}
      {tooltip && (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className={styles.tooltipRow}>
            <span className={styles.tooltipOrg}>
              {tooltip.res.organization}
            </span>
            <span
              className={styles.tooltipBadge}
              style={{ color: STATUS_COLOR[tooltip.res.status] ?? "#555" }}
            >
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
                <span>
                  {typeRooms.map((r) => r.roomNumber + "호").join(", ")}
                </span>
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
          onConfirm={() => { }}
          onClose={() => setDateView(null)}
          viewOnly
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
