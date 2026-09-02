"use client";

import ReservationModal from "@/components/reservation/ReservationModal";
import ReservationTooltip from "@/components/scheduler/ReservationTooltip";
import MonthNavigator from "@/components/ui/MonthNavigator";
import {
  createReservation,
  getReservationsByRange,
  toRequestBody,
  updateReservation,
} from "@/lib/api/reservation";
import { getDisabledClassrooms } from "@/lib/api/settings";
import { printSchedulerWeekly } from "@/lib/utils/printRoomTable";
import { Reservation } from "@/types/reservation";
import { isHoliday } from "@hyunbinseo/holidays-kr";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function checkIsHoliday(date: Date): boolean {
  try {
    return isHoliday(date);
  } catch {
    return false;
  }
}

const CLASSROOM_GROUPS = [
  { type: "대강의실", bg: "bgDaeGang", rooms: [{ id: "105", cap: 120 }] },
  {
    type: "중강의실",
    bg: "bgJungGang",
    rooms: [
      { id: "201", cap: 70 },
      { id: "203", cap: 50 },
      { id: "204", cap: 50 },
    ],
  },
  {
    type: "소강의실",
    bg: "bgSoGang",
    rooms: [
      { id: "101", cap: 30 },
      { id: "102", cap: 20 },
      { id: "103", cap: 30 },
      { id: "202", cap: 30 },
    ],
  },
  {
    type: "분임실",
    bg: "bgBunim",
    rooms: [
      { id: "106", cap: 12 },
      { id: "107", cap: 12 },
      { id: "205", cap: 12 },
      { id: "206", cap: 12 },
    ],
  },
  {
    type: "다목적실",
    bg: "bgDamok",
    rooms: [
      { id: "A", cap: 80 },
      { id: "B", cap: 40 },
    ],
  },
];

const TYPE_W = 38;
const ROOM_W = 28;
const CAP_W = 20;
const DATE_COL = 36;

function makeDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

interface CalDay {
  date: Date;
  dateStr: string;
  isCurrent: boolean; // 이번 달 여부
}

// 강의실 셀 드래그로 사각형(호실 N행 × 날짜 N일) 선택
interface DragSel {
  half: number; // halves 인덱스 (블록 밖으로는 드래그 안 됨)
  anchorRoom: string; // 드래그 시작 호실
  hoverRoom: string; // 현재 포인터 호실
  anchorDate: string; // 드래그 시작 dateStr
  hoverDate: string; // 현재 포인터 dateStr
  additive: boolean; // ⌘/Ctrl 누른 채 드래그 → 누적 선택(비연속 강의실 가능)
}

export default function SchedulerPage() {
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [disabledClassrooms, setDisabledClassrooms] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<Reservation | null>(null);
  const [createDefaults, setCreateDefaults] = useState<{
    date: string;
    endDate?: string;
    roomId?: string;
    cells?: { roomId: string; dateStr: string }[]; // 강의실 드래그 사각형 선택
  } | null>(null);
  const [drag, setDrag] = useState<DragSel | null>(null);
  // ⌘/Ctrl+드래그로 쌓은 누적 선택 (비연속 강의실, 앞/뒤 블록 넘나듦 허용). "roomId|dateStr"
  const [multiSel, setMultiSel] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const fetchReservations = (y: number, m: number) => {
    // 전달 1일 ~ 다음달 말일 (trailing 포함 3개월 커버)
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m + 2, 0); // 다음달 말일
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    setIsLoading(true);
    getReservationsByRange(fmt(from), fmt(to))
      .then(setReservations)
      .catch(() => alert("예약 데이터를 불러오는데 실패했습니다."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchReservations(year, month);
  }, [year, month]);

  useEffect(() => {
    getDisabledClassrooms()
      .then((codes) => setDisabledClassrooms(new Set(codes)))
      .catch(() => {});
  }, []);

  // year/month가 바뀔 때만 달력 날짜 배열 재생성
  const calDays = useMemo<CalDay[]>(() => {
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const lastDayOfWeek = new Date(year, month + 1, 0).getDay();
    const days: CalDay[] = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, dateStr: makeDateStr(d), isCurrent: false });
    }
    for (let i = 1; i <= lastDate; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, dateStr: makeDateStr(d), isCurrent: true });
    }
    const trailing = lastDayOfWeek === 6 ? 0 : 6 - lastDayOfWeek;
    for (let i = 1; i <= trailing; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateStr: makeDateStr(d), isCurrent: false });
    }
    return days;
  }, [year, month]);

  const halves = useMemo<CalDay[][]>(() => {
    const half1 = Math.ceil(calDays.length / 2);
    return [calDays.slice(0, half1), calDays.slice(half1)].filter((h) => h.length > 0);
  }, [calDays]);

  // checkIsHoliday 호출이 비싸므로 Set으로 미리 계산
  const redDaySet = useMemo(
    () => new Set(
      calDays
        .filter((c) => c.date.getDay() === 0 || c.date.getDay() === 6 || checkIsHoliday(c.date))
        .map((c) => c.dateStr),
    ),
    [calDays],
  );

  // ── 스타일 헬퍼 ──
  // 토요일 / 일요일·공휴일 구분 (다크 모드에서 색상이 갈림)
  const dayKind = (cal: CalDay): "sat" | "sun" | null => {
    const dow = cal.date.getDay();
    if (dow === 6) return "sat";
    if (dow === 0) return "sun";
    if (redDaySet.has(cal.dateStr)) return "sun"; // 평일 공휴일은 일요일과 동일 취급
    return null;
  };

  const thCls = (cal: CalDay) => {
    if (!cal.isCurrent) return styles.otherMonthTh;
    const kind = dayKind(cal);
    if (kind === "sat") return `${styles.weekendTh} ${styles.satTh}`;
    if (kind === "sun") return `${styles.weekendTh} ${styles.sunTh}`;
    return "";
  };

  const tdCls = (cal: CalDay) => {
    if (!cal.isCurrent) return styles.otherMonthCol;
    const kind = dayKind(cal);
    if (kind === "sat") return `${styles.weekendCol} ${styles.satCol}`;
    if (kind === "sun") return `${styles.weekendCol} ${styles.sunCol}`;
    return "";
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

  const handleSave = async (data: Reservation) => {
    const body = toRequestBody(data);
    await updateReservation(data.id, body);
    fetchReservations(year, month);
  };

  const handleCreate = async (data: Reservation) => {
    const body = toRequestBody(data);
    await createReservation(body);
    fetchReservations(year, month);
  };

  const handleCellDoubleClick = (dateStr: string, roomId: string) => {
    setCreateDefaults({ date: dateStr, roomId });
  };

  // ── 데이터 조회 ──
  const getClassroomRes = (roomId: string, dateStr: string) =>
    reservations.find(
      (r) =>
        r.status !== "취소" &&
        r.classrooms?.some(
          (c) =>
            c.classroomName === roomId && String(c.reservedDate) === dateStr,
        ),
    );

  // ── 강의실 드래그 사각형 선택 ──
  // 세로: 보이는 강의실 행 순서(그룹 경계 넘나듦), 가로: 같은 2주 블록 안의 날짜.
  const visibleRoomIds = useMemo(
    () =>
      CLASSROOM_GROUPS.flatMap((g) =>
        g.rooms.filter((r) => !disabledClassrooms.has(r.id)).map((r) => r.id),
      ),
    [disabledClassrooms],
  );

  // 예약이 이미 있는 (호실|날짜) 집합 — 사각형에 하나라도 걸리면 드래그 무효
  const occupiedSet = useMemo(() => {
    const s = new Set<string>();
    reservations.forEach((r) => {
      if (r.status === "취소") return;
      r.classrooms?.forEach((c) =>
        s.add(`${c.classroomName}|${String(c.reservedDate)}`),
      );
    });
    return s;
  }, [reservations]);

  // anchor~hover 사각형의 모든 셀. 예약과 겹치면 null(무효).
  const computeDragCells = (
    d: DragSel,
  ): { roomId: string; dateStr: string }[] | null => {
    const hd = halves[d.half];
    if (!hd) return null;
    const dA = hd.findIndex((x) => x.dateStr === d.anchorDate);
    const dH = hd.findIndex((x) => x.dateStr === d.hoverDate);
    const rA = visibleRoomIds.indexOf(d.anchorRoom);
    const rH = visibleRoomIds.indexOf(d.hoverRoom);
    if (dA < 0 || dH < 0 || rA < 0 || rH < 0) return null;
    const rooms = visibleRoomIds.slice(Math.min(rA, rH), Math.max(rA, rH) + 1);
    const dates = hd
      .slice(Math.min(dA, dH), Math.max(dA, dH) + 1)
      .map((x) => x.dateStr);
    const out: { roomId: string; dateStr: string }[] = [];
    for (const roomId of rooms) {
      for (const dateStr of dates) {
        if (occupiedSet.has(`${roomId}|${dateStr}`)) return null; // 겹침 → 전체 무효
        out.push({ roomId, dateStr });
      }
    }
    return out;
  };

  const dragCells = drag ? computeDragCells(drag) : null;
  const dragCellSet = dragCells
    ? new Set(dragCells.map((c) => `${c.roomId}|${c.dateStr}`))
    : null;
  const dragging = drag !== null;

  const clearMultiSel = () => {
    setMultiSel(new Set());
  };

  // 누적 선택 → 예약 모달 (여러 호실 × 여러 날짜, 비연속 포함)
  const commitMultiSel = () => {
    const cells = [...multiSel].map((k) => {
      const [roomId, dateStr] = k.split("|");
      return { roomId, dateStr };
    });
    if (cells.length === 0) return;
    const dates = [...new Set(cells.map((c) => c.dateStr))].sort();
    setCreateDefaults({
      date: dates[0],
      endDate: dates[dates.length - 1],
      roomId: cells[0].roomId,
      cells,
    });
    clearMultiSel();
  };

  // 마우스를 어디서 떼든 드래그 종료
  // - 일반 드래그: 2셀 이상이면 바로 예약 모달
  // - ⌘/Ctrl 드래그: 모달 대신 누적 선택에 합침
  useEffect(() => {
    if (!dragging) return;
    const finish = () => {
      setDrag((d) => {
        if (!d) return null;
        const cells = computeDragCells(d);
        if (cells && cells.length > 0) {
          if (d.additive) {
            const merged = new Set(multiSel);
            if (cells.length === 1) {
              // 클릭 한 칸 = 토글: 이미 선택돼 있으면 다시 눌러서 취소
              const key = `${cells[0].roomId}|${cells[0].dateStr}`;
              if (merged.has(key)) merged.delete(key);
              else merged.add(key);
            } else {
              cells.forEach((c) => merged.add(`${c.roomId}|${c.dateStr}`));
            }
            setMultiSel(merged);
          } else if (cells.length >= 2) {
            const dates = [...new Set(cells.map((c) => c.dateStr))].sort();
            setCreateDefaults({
              date: dates[0],
              endDate: dates[dates.length - 1],
              roomId: d.anchorRoom,
              cells,
            });
          }
        }
        return null;
      });
    };
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

  // 누적 선택 중 Esc → 선택 해제
  useEffect(() => {
    if (multiSel.size === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearMultiSel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [multiSel.size]);

  const getRoomCount = (dateStr: string, type: string) => {
    let count = 0;
    reservations.forEach((r) => {
      if (r.status !== "취소")
        r.rooms?.forEach((rm) => {
          if (String(rm.reservedDate) === dateStr && rm.roomType === type)
            count++;
        });
    });
    return count;
  };

  return (
    <div id="schedulerPrintArea" className={styles.schedulerPage}>
      <div className={styles.header}>
        <div className={styles.headerActions}>
          <button className={styles.printBtn} onClick={() => window.print()}>
            🖨 인쇄 / PDF
          </button>
          <button
            className={styles.printBtn}
            onClick={() => printSchedulerWeekly(year, month, reservations)}
          >
            🖨 주차별 인쇄
          </button>
          <span className={styles.dragHint}>
            빈칸 드래그로 예약 · ⌘/Ctrl+드래그로 여러 강의실
          </span>
        </div>
        <div className={styles.monthNavigatorCard}>
          <MonthNavigator
            year={year}
            month={month}
            onPrev={prevMonth}
            onNext={nextMonth}
            onJump={(y, m) => {
              setYear(y);
              setMonth(m);
            }}
          />
        </div>
      </div>

      <div className={styles.printTitle}>
        {year}년 {month + 1}월 일정 현황
      </div>

      {isLoading ? (
        <div className={styles.loadingOverlay}>
          <p className={styles.loadingText}>데이터를 가져오는 중...</p>
        </div>
      ) : (
        halves.map((halfDays, hi) => {
          const leftW = TYPE_W + ROOM_W + CAP_W + halfDays.length * DATE_COL;

          return (
            <div key={hi} className={styles.halfBlock}>
              {/* ── 일정 현황 ── */}
              <div className={styles.tableWrap}>
                <div className={styles.sectionTitle}>일정 현황</div>
                <div className={styles.tableScroll}>
                <div style={{ minWidth: leftW, width: "100%" }}>
                  <table
                    className={`${styles.table}${drag ? ` ${styles.dragging}` : ""}`}
                    style={{ minWidth: leftW, width: "100%" }}
                  >
                    <colgroup>
                      <col style={{ width: `${TYPE_W}px` }} />
                      <col style={{ width: `${ROOM_W}px` }} />
                      <col style={{ width: `${CAP_W}px` }} />
                      {halfDays.map((cal) => (
                        <col
                          key={cal.dateStr}
                          style={{ width: `${DATE_COL}px` }}
                        />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={styles.thType}>구분</th>
                        <th className={styles.thRoom}>호실</th>
                        <th className={styles.thCap}>정원</th>
                        {halfDays.map((cal) => (
                          <th key={cal.dateStr} className={thCls(cal)}>
                            <div className={styles.dateNum}>
                              {cal.date.getDate()}일
                            </div>
                            <div className={styles.dayLabel}>
                              {WEEK_DAYS[cal.date.getDay()]}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CLASSROOM_GROUPS.flatMap((group) => {
                        const visibleRooms = group.rooms.filter((r) => !disabledClassrooms.has(r.id));
                        if (visibleRooms.length === 0) return [];
                        return [{ ...group, rooms: visibleRooms }];
                      }).map((group, gi) =>
                        group.rooms.map((room, ri) => {
                          // colspan 스패닝: 연속된 같은 예약을 하나의 셀로 묶음
                          const cells: {
                            cal: CalDay;
                            res: ReturnType<typeof getClassroomRes>;
                            span: number;
                          }[] = [];
                          let di = 0;
                          while (di < halfDays.length) {
                            const cal = halfDays[di];
                            const res = getClassroomRes(room.id, cal.dateStr);
                            if (res) {
                              let span = 1;
                              while (di + span < halfDays.length) {
                                const nr = getClassroomRes(
                                  room.id,
                                  halfDays[di + span].dateStr,
                                );
                                if (nr && nr.id === res.id) span++;
                                else break;
                              }
                              cells.push({ cal, res, span });
                              di += span;
                            } else {
                              cells.push({ cal, res: undefined, span: 1 });
                              di++;
                            }
                          }
                          return (
                            <tr key={`${gi}-${ri}`}>
                              {ri === 0 && (
                                <td
                                  className={`${styles.tdType} ${styles[group.bg]}${gi > 0 ? ` ${styles.groupDivider}` : ""}`}
                                  rowSpan={group.rooms.length}
                                >
                                  {group.type}
                                </td>
                              )}
                              <td
                                className={`${styles.tdRoom} ${styles[group.bg]}${ri === 0 && gi > 0 ? ` ${styles.groupDivider}` : ""}`}
                              >
                                {/^\d+$/.test(room.id)
                                  ? `${room.id} 호`
                                  : room.id}
                              </td>
                              <td
                                className={`${styles.tdCap} ${styles[group.bg]}${ri === 0 && gi > 0 ? ` ${styles.groupDivider}` : ""}`}
                              >
                                {room.cap != null ? `${room.cap} 인` : ""}
                              </td>
                              {cells.map(({ cal, res, span }) => {
                                const cellKey = `${room.id}|${cal.dateStr}`;
                                const inDrag =
                                  (drag?.half === hi &&
                                    !!dragCellSet?.has(cellKey)) ||
                                  multiSel.has(cellKey);
                                return (
                                <td
                                  key={cal.dateStr}
                                  colSpan={span > 1 ? span : undefined}
                                  className={`${tdCls(cal) || styles[group.bg]}${ri === 0 && gi > 0 ? ` ${styles.groupDivider}` : ""}${inDrag ? ` ${styles.dragSel}` : ""}`}
                                  onMouseDown={
                                    res
                                      ? undefined
                                      : (e) => {
                                          if (e.button !== 0) return;
                                          e.preventDefault(); // 텍스트 선택 방지
                                          const additive =
                                            e.metaKey ||
                                            e.ctrlKey ||
                                            multiSel.size > 0;
                                          // 누적 선택은 앞/뒤 2주 블록을 넘나들어도 됨
                                          setDrag({
                                            half: hi,
                                            anchorRoom: room.id,
                                            hoverRoom: room.id,
                                            anchorDate: cal.dateStr,
                                            hoverDate: cal.dateStr,
                                            additive,
                                          });
                                        }
                                  }
                                  onMouseEnter={() =>
                                    setDrag((d) => {
                                      if (!d || d.half !== hi) return d;
                                      const cand = {
                                        ...d,
                                        hoverRoom: room.id,
                                        hoverDate: cal.dateStr,
                                      };
                                      // 예약과 겹치는 확장은 거부(직전 상태 유지)
                                      return computeDragCells(cand) ? cand : d;
                                    })
                                  }
                                  onDoubleClick={() =>
                                    !res &&
                                    handleCellDoubleClick(cal.dateStr, room.id)
                                  }
                                  style={{ cursor: res ? undefined : "cell" }}
                                >
                                  {res && (
                                    <ReservationTooltip reservation={res}>
                                      <span
                                        className={styles.bar}
                                        style={{
                                          backgroundColor: res.colorCode,
                                          cursor: "pointer",
                                        }}
                                        onClick={() => setEditTarget(res)}
                                      >
                                        {res.organization}
                                      </span>
                                    </ReservationTooltip>
                                  )}
                                </td>
                                );
                              })}
                            </tr>
                          );
                        }),
                      )}
                      {/* ── 숙박 섹션 ── */}
                      {(() => {
                        const halfRoomRes = reservations.filter(
                          (r) =>
                            r.status !== "취소" &&
                            r.rooms?.some((rm) =>
                              halfDays.some(
                                (d) => d.dateStr === String(rm.reservedDate),
                              ),
                            ),
                        );

                        // 레인 패킹: 날짜 안 겹치면 같은 행에 배치
                        const lanes: Reservation[][] = [];
                        for (const res of halfRoomRes) {
                          const resDates = new Set(
                            res.rooms?.map((rm) => String(rm.reservedDate)) ??
                              [],
                          );
                          let placed = false;
                          for (const lane of lanes) {
                            const conflict = lane.some((r) =>
                              r.rooms?.some((rm) =>
                                resDates.has(String(rm.reservedDate)),
                              ),
                            );
                            if (!conflict) {
                              lane.push(res);
                              placed = true;
                              break;
                            }
                          }
                          if (!placed) lanes.push([res]);
                        }

                        const totalSpan = lanes.length + 1;
                        return (
                          <>
                            {lanes.map((lane, idx) => {
                              const isFirst = idx === 0;
                              // colspan 스패닝
                              const cells: {
                                cal: CalDay;
                                res: Reservation | undefined;
                                span: number;
                                isLast: boolean;
                              }[] = [];
                              let di = 0;
                              while (di < halfDays.length) {
                                const cal = halfDays[di];
                                const res = lane.find((r) =>
                                  r.rooms?.some(
                                    (rm) =>
                                      String(rm.reservedDate) === cal.dateStr,
                                  ),
                                );
                                if (res) {
                                  let span = 1;
                                  while (di + span < halfDays.length) {
                                    const hasNext = res.rooms?.some(
                                      (rm) =>
                                        String(rm.reservedDate) ===
                                        halfDays[di + span].dateStr,
                                    );
                                    if (hasNext) span++;
                                    else break;
                                  }
                                  cells.push({
                                    cal,
                                    res,
                                    span,
                                    isLast: di + span === halfDays.length,
                                  });
                                  di += span;
                                } else {
                                  cells.push({
                                    cal,
                                    res: undefined,
                                    span: 1,
                                    isLast: di + 1 === halfDays.length,
                                  });
                                  di++;
                                }
                              }
                              return (
                                <tr key={`lane-${idx}`}>
                                  {isFirst && (
                                    <td
                                      className={`${styles.tdType} ${styles.bgAccom} ${styles.roomTopBorder} ${styles.roomBottomBorder} ${styles.roomLeftBorder} ${styles.roomCornerTL} ${styles.roomCornerBL}`}
                                      rowSpan={totalSpan}
                                    >
                                      숙박
                                    </td>
                                  )}
                                  <td
                                    className={`${styles.tdRoom} ${styles.bgAccom} ${isFirst ? styles.roomTopBorder : styles.roomInnerRow}`}
                                  />
                                  <td
                                    className={`${styles.tdCap} ${styles.bgAccom} ${isFirst ? styles.roomTopBorder : styles.roomInnerRow}`}
                                  />
                                  {cells.map(({ cal, res, span, isLast }) => {
                                    const endDate = new Date(cal.date);
                                    endDate.setDate(endDate.getDate() + 1);
                                    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
                                    return (
                                      <td
                                        key={cal.dateStr}
                                        colSpan={span > 1 ? span : undefined}
                                        className={`${tdCls(cal) || styles.bgAccom} ${isFirst ? styles.roomTopBorder : ""} ${isLast ? `${styles.roomRightBorder} ${isFirst ? styles.roomCornerTR : ""}` : ""}`}
                                        onDoubleClick={() =>
                                          !res &&
                                          setCreateDefaults({
                                            date: cal.dateStr,
                                            endDate: endDateStr,
                                          })
                                        }
                                      >
                                        {res && (
                                          <ReservationTooltip reservation={res}>
                                            <span
                                              className={styles.bar}
                                              style={{
                                                backgroundColor: res.colorCode,
                                                cursor: "pointer",
                                              }}
                                              onClick={() => setEditTarget(res)}
                                            >
                                              {res.organization}
                                            </span>
                                          </ReservationTooltip>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                            <tr key="room-계">
                              {lanes.length === 0 && (
                                <td
                                  className={`${styles.tdType} ${styles.bgAccom} ${styles.roomTopBorder} ${styles.roomBottomBorder} ${styles.roomLeftBorder}`}
                                >
                                  숙박
                                </td>
                              )}
                              <td
                                className={`${styles.tdRoom} ${styles.bgAccom} ${lanes.length === 0 ? styles.roomTopBorder : ""} ${styles.roomBottomBorder}`}
                              >
                                계(4/2/1인실)
                              </td>
                              <td
                                className={`${styles.tdCap} ${styles.bgAccom} ${lanes.length === 0 ? styles.roomTopBorder : ""} ${styles.roomBottomBorder}`}
                              />
                              {halfDays.map((cal) => {
                                const c4 = getRoomCount(cal.dateStr, "4인실");
                                const c2 = getRoomCount(cal.dateStr, "2인실");
                                const c1 = getRoomCount(cal.dateStr, "1인실");
                                const total = c4 + c2 + c1;
                                const endDate = new Date(cal.date);
                                endDate.setDate(endDate.getDate() + 1);
                                const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
                                return (
                                  <td
                                    key={cal.dateStr}
                                    className={`${tdCls(cal) || styles.bgAccom} ${styles.roomTotalCell} ${lanes.length === 0 ? `${styles.roomTopBorder} ${styles.roomCornerTL}` : ""} ${styles.roomBottomBorder} ${cal.dateStr === halfDays[halfDays.length - 1].dateStr ? `${styles.roomRightBorder} ${styles.roomCornerBR} ${lanes.length === 0 ? styles.roomCornerTR : ""}` : ""}`}
                                    onDoubleClick={() =>
                                      setCreateDefaults({
                                        date: cal.dateStr,
                                        endDate: endDateStr,
                                      })
                                    }
                                  >
                                    {total > 0 && `${c4}/${c2}/${c1}`}
                                  </td>
                                );
                              })}
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {multiSel.size > 0 && (
        <div className={styles.multiSelBar}>
          <span className={styles.multiSelCount}>{multiSel.size}칸 선택</span>
          <span className={styles.multiSelHint}>
            ⌘/Ctrl+드래그로 추가 · 선택된 칸 다시 클릭하면 해제 · Esc 전체 취소
          </span>
          <button className={styles.multiSelCommit} onClick={commitMultiSel}>
            예약 생성
          </button>
          <button className={styles.multiSelCancel} onClick={clearMultiSel}>
            취소
          </button>
        </div>
      )}

      {editTarget && (
        <ReservationModal
          reservation={editTarget}
          allReservations={reservations}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
        />
      )}

      {createDefaults && (
        <ReservationModal
          reservation={null}
          allReservations={reservations}
          onClose={() => setCreateDefaults(null)}
          onSave={handleCreate}
          defaultValues={
            createDefaults.roomId
              ? {
                  startDate: createDefaults.date,
                  endDate: createDefaults.endDate ?? createDefaults.date,
                  classrooms: (
                    createDefaults.cells ?? [
                      {
                        roomId: createDefaults.roomId as string,
                        dateStr: createDefaults.date,
                      },
                    ]
                  ).map((c) => ({
                    classroomName: c.roomId,
                    reservedDate: c.dateStr,
                  })),
                }
              : {
                  startDate: createDefaults.date,
                  endDate: createDefaults.endDate ?? createDefaults.date,
                }
          }
        />
      )}
    </div>
  );
}
