"use client";

import ReservationDetailModal from "@/components/dashboard/ReservationDetailModal";
import ReservationModal from "@/components/reservation/ReservationModal";
import ReservationTooltip from "@/components/scheduler/ReservationTooltip";
import MonthSwitcher from "@/components/scheduler/MonthSwitcher";
import RefreshStatus from "@/components/ui/RefreshStatus";
import { usePolling } from "@/hooks/usePolling";
import {
  createReservation,
  getReservationsByRange,
  toRequestBody,
  updateReservation,
} from "@/lib/api/reservation";
import { getDisabledClassrooms } from "@/lib/api/settings";
import { isAdmin } from "@/lib/utils/auth";
import { formatMonthDay, toChipColor } from "@/lib/utils/dashboard";
import { printSchedulerWeekly } from "@/lib/utils/printRoomTable";
import { Reservation } from "@/types/reservation";
import { isHoliday } from "@hyunbinseo/holidays-kr";
import { Printer } from "lucide-react";
import { CSSProperties, useEffect, useMemo, useState } from "react";
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
  { type: "대강의실", rooms: [{ id: "105", cap: 120 }] },
  {
    type: "중강의실",
    rooms: [
      { id: "201", cap: 70 },
      { id: "203", cap: 50 },
      { id: "204", cap: 50 },
    ],
  },
  {
    type: "소강의실",
    rooms: [
      { id: "101", cap: 30 },
      { id: "102", cap: 20 },
      { id: "103", cap: 30 },
      { id: "202", cap: 30 },
    ],
  },
  {
    type: "분임실",
    rooms: [
      { id: "106", cap: 12 },
      { id: "107", cap: 12 },
      { id: "205", cap: 12 },
      { id: "206", cap: 12 },
    ],
  },
  {
    type: "다목적실",
    rooms: [
      { id: "A", cap: 80 },
      { id: "B", cap: 40 },
    ],
  },
];

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
  // 관리자가 아니면 수정 모달 대신 읽기 전용 상세를 보여준다
  const [detailTarget, setDetailTarget] = useState<Reservation | null>(null);
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

  // silent: true면 다른 사용자의 변경을 조용히 반영(폴링용) — 로딩 오버레이/알럿 없이
  const fetchReservations = (y: number, m: number, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    // 전달 1일 ~ 다음달 말일 (trailing 포함 3개월 커버)
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m + 2, 0); // 다음달 말일
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!silent) setIsLoading(true);
    return getReservationsByRange(fmt(from), fmt(to))
      .then(setReservations)
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

  // ── 렌더링 헬퍼 ──
  const todayStr = makeDateStr(today);
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  const shiftDate = (d: Date, n: number) =>
    makeDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));

  // 날짜 라벨: 보통 "1", "2"… / 기간의 첫 칸이 다른 달이거나 달이 바뀌는 칸은 "10/30", "12/1"
  const dayLabel = (cal: CalDay, i: number) =>
    (i === 0 && !cal.isCurrent) || (i > 0 && cal.date.getDate() === 1)
      ? `${cal.date.getMonth() + 1}/${cal.date.getDate()}`
      : String(cal.date.getDate());

  // 열 배경 — 헤더부터 마지막 줄까지 같은 규칙 (오늘 > 다른 달 > 주말)
  const colBg = (cal: CalDay) => {
    if (cal.dateStr === todayStr) return styles.today;
    if (!cal.isCurrent) return styles.outside;
    return dayKind(cal) ? styles.weekend : "";
  };
  const monthStartCls = (cal: CalDay, i: number) =>
    i > 0 && cal.date.getDate() === 1 ? styles.monthStart : "";

  // 연속된 같은 예약을 한 덩어리(grid-column span)로 묶는다
  interface Run {
    idx: number;
    span: number;
    res: Reservation;
    cutL: boolean; // 이 기간 앞에서 이어짐
    cutR: boolean; // 이 기간 뒤로 이어짐
  }
  const buildRuns = (
    days: CalDay[],
    resAt: (dateStr: string) => Reservation | undefined,
  ): Run[] => {
    const runs: Run[] = [];
    let di = 0;
    while (di < days.length) {
      const res = resAt(days[di].dateStr);
      if (!res) {
        di++;
        continue;
      }
      let span = 1;
      while (di + span < days.length && resAt(days[di + span].dateStr)?.id === res.id) span++;
      runs.push({
        idx: di,
        span,
        res,
        cutL: resAt(shiftDate(days[di].date, -1))?.id === res.id,
        cutR: resAt(shiftDate(days[di + span - 1].date, 1))?.id === res.id,
      });
      di += span;
    }
    return runs;
  };

  const barLabel = (run: Run) => {
    const { res, cutL, cutR } = run;
    const from = formatMonthDay(res.startDate);
    const to = formatMonthDay(res.endDate);
    const range = cutL && cutR ? `${from}~${to}` : cutL ? `${from}~` : cutR ? `~${to}` : "";
    return `${cutL ? "‹ " : ""}${res.organization}${range ? ` · ${range}` : ""}${cutR ? " ›" : ""}`;
  };

  const renderBar = (run: Run, roomLabel: string, key: string) => {
    const color = toChipColor(run.res.colorCode);
    const style = {
      gridColumn: `${run.idx + 2} / span ${run.span}`,
      "--c": color.rgb,
      "--fg-light": color.fgLight,
      "--fg-dark": color.fgDark,
    } as CSSProperties;
    return (
      <ReservationTooltip key={key} reservation={run.res}>
        <button
          type="button"
          className={`${styles.bar}${run.cutL ? ` ${styles.barCutL}` : ""}${run.cutR ? ` ${styles.barCutR}` : ""}`}
          style={style}
          aria-label={`${run.res.organization} ${roomLabel} ${run.res.startDate}부터 ${run.res.endDate}까지`}
          onClick={() =>
            isAdmin() ? setEditTarget(run.res) : setDetailTarget(run.res)
          }
        >
          {barLabel(run)}
        </button>
      </ReservationTooltip>
    );
  };

  // 카드 제목 줄 보조 문구
  const cardNote = (days: CalDay[]) => {
    const notes: string[] = [];
    const first = days.findIndex((d) => d.isCurrent);
    const last = days.length - 1 - [...days].reverse().findIndex((d) => d.isCurrent);
    if (first > 0) {
      const lead = days.slice(0, first);
      const leadSet = new Set(lead.map((d) => d.dateStr));
      const hasCarry = reservations.some(
        (r) =>
          r.status !== "취소" &&
          (r.classrooms?.some((c) => leadSet.has(String(c.reservedDate))) ||
            r.rooms?.some((c) => leadSet.has(String(c.reservedDate)))),
      );
      if (hasCarry) {
        const f = lead[0].date;
        const l = lead[lead.length - 1].date;
        notes.push(`전월 이월 예약이 있어 ${f.getMonth() + 1}/${f.getDate()}~${l.getMonth() + 1}/${l.getDate()}도 함께 표시`);
      }
    }
    if (last >= 0 && last < days.length - 1) {
      notes.push(`${days[last + 1].date.getMonth() + 1}월 ${days[last + 1].date.getDate()}일부터는 다음 달 일정`);
    }
    return notes.join(" · ");
  };

  const visibleGroups = CLASSROOM_GROUPS.map((g) => ({
    ...g,
    rooms: g.rooms.filter((r) => !disabledClassrooms.has(r.id)),
  })).filter((g) => g.rooms.length > 0);

  return (
    <div id="schedulerPrintArea" className={styles.schedulerPage}>
      <div className={styles.pageHead}>
        <h1 className={styles.pageTitle}>일정 현황</h1>
        <p className={styles.pageDesc}>강의실별 대관과 숙박 일정을 기간별로 확인합니다</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
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
          <button type="button" className={styles.btn} onClick={goToday}>
            오늘
          </button>
          <span className={styles.hint}>
            빈칸 드래그로 예약 · <kbd className={styles.kbd}>⌘/Ctrl</kbd>+드래그로 여러 강의실
          </span>
        </div>
        <div className={styles.toolbarRight}>
          <RefreshStatus lastUpdated={lastUpdated} onRefresh={refetchNow} />
          <button type="button" className={styles.btn} onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" />
            인쇄 / PDF
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => printSchedulerWeekly(year, month, reservations)}
          >
            <Printer size={14} aria-hidden="true" />
            주차별 인쇄
          </button>
        </div>
      </div>

      <div className={styles.printTitle}>
        {year}년 {month + 1}월 일정 현황
      </div>

      {isLoading ? (
        <div className={styles.loading} role="status">
          데이터를 가져오는 중...
        </div>
      ) : (
        halves.map((halfDays, hi) => {
          const first = halfDays[0].date;
          const last = halfDays[halfDays.length - 1].date;
          const note = cardNote(halfDays);
          const gridVars = { "--n": halfDays.length } as CSSProperties;

          // 숙박: 레인 패킹 — 날짜가 안 겹치면 같은 줄에 배치
          const halfRoomRes = reservations.filter(
            (r) =>
              r.status !== "취소" &&
              r.rooms?.some((rm) => halfDays.some((d) => d.dateStr === String(rm.reservedDate))),
          );
          const lanes: Reservation[][] = [];
          for (const res of halfRoomRes) {
            const resDates = new Set(res.rooms?.map((rm) => String(rm.reservedDate)) ?? []);
            const lane = lanes.find(
              (l) => !l.some((r) => r.rooms?.some((rm) => resDates.has(String(rm.reservedDate)))),
            );
            if (lane) lane.push(res);
            else lanes.push([res]);
          }
          if (lanes.length === 0) lanes.push([]);

          return (
            <section key={hi} className={styles.card}>
              <div className={styles.cardHead}>
                <h2 className={styles.cardTitle}>
                  {first.getMonth() + 1}월 {first.getDate()}일 – {last.getMonth() + 1}월 {last.getDate()}일
                </h2>
                {note && <span className={styles.cardNote}>{note}</span>}
              </div>

              <div className={styles.scroll}>
                <div className={`${styles.gantt}${drag ? ` ${styles.dragging}` : ""}`}>
                  {/* 날짜 헤더 */}
                  <div className={`${styles.row} ${styles.headRow}`} style={gridVars}>
                    <div className={styles.headLabel}>구분 · 호실 · 정원</div>
                    {halfDays.map((cal, i) => {
                      const kind = dayKind(cal);
                      return (
                        <div
                          key={cal.dateStr}
                          className={[
                            styles.dayHead,
                            colBg(cal),
                            monthStartCls(cal, i),
                            kind ? styles[kind] : "",
                            cal.isCurrent ? "" : styles.dayHeadOutside,
                            cal.dateStr === todayStr ? styles.todayHead : "",
                          ].join(" ")}
                          style={{ gridColumn: i + 2 }}
                        >
                          <div className={styles.dateNum}>{dayLabel(cal, i)}</div>
                          <div className={styles.dayName}>{WEEK_DAYS[cal.date.getDay()]}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 강의실 그룹 */}
                  {visibleGroups.map((group) => (
                    <div key={group.type} className={styles.group}>
                      <div className={styles.typeCell}>{group.type}</div>
                      {group.rooms.map((room) => {
                        const roomLabel = /^\d+$/.test(room.id) ? `${room.id}호` : room.id;
                        const runs = buildRuns(halfDays, (d) => getClassroomRes(room.id, d));
                        return (
                          <div key={room.id} className={`${styles.row} ${styles.roomRow}`} style={gridVars}>
                            <div className={styles.label}>
                              <span className={styles.roomNo}>{roomLabel}</span>
                              <span className={styles.roomCap}>{room.cap}인</span>
                            </div>
                            {halfDays.map((cal, i) => {
                              const res = getClassroomRes(room.id, cal.dateStr);
                              const cellKey = `${room.id}|${cal.dateStr}`;
                              const inDrag = (drag?.half === hi && !!dragCellSet?.has(cellKey)) || multiSel.has(cellKey);
                              return (
                                <div
                                  key={cal.dateStr}
                                  className={[
                                    styles.cell,
                                    colBg(cal),
                                    monthStartCls(cal, i),
                                    res ? "" : styles.cellFree,
                                    inDrag ? styles.dragSel : "",
                                  ].join(" ")}
                                  style={{ gridColumn: i + 2 }}
                                  onMouseDown={
                                    res
                                      ? undefined
                                      : (e) => {
                                          if (e.button !== 0) return;
                                          e.preventDefault(); // 텍스트 선택 방지
                                          const additive = e.metaKey || e.ctrlKey || multiSel.size > 0;
                                          // 누적 선택은 앞/뒤 블록을 넘나들어도 됨
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
                                      const cand = { ...d, hoverRoom: room.id, hoverDate: cal.dateStr };
                                      // 예약과 겹치는 확장은 거부(직전 상태 유지)
                                      return computeDragCells(cand) ? cand : d;
                                    })
                                  }
                                  onDoubleClick={() => !res && handleCellDoubleClick(cal.dateStr, room.id)}
                                />
                              );
                            })}
                            {runs.map((run) => renderBar(run, roomLabel, `${room.id}-${run.idx}`))}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* 숙박 */}
                  <div className={`${styles.group} ${styles.lodgeGroup}`}>
                  <div className={`${styles.typeCell} ${styles.typeLodge}`}>숙박</div>
                  {lanes.map((lane, li) => {
                    const runs = buildRuns(halfDays, (d) =>
                      lane.find((r) => r.rooms?.some((rm) => String(rm.reservedDate) === d)),
                    );
                    return (
                      <div key={`lane-${li}`} className={`${styles.row} ${styles.roomRow} ${styles.lodgeRow}`} style={gridVars}>
                        <div className={styles.label}>
                          {li === 0 && <span className={styles.roomNo}>투숙 일정</span>}
                        </div>
                        {halfDays.map((cal, i) => {
                          const has = lane.some((r) => r.rooms?.some((rm) => String(rm.reservedDate) === cal.dateStr));
                          return (
                            <div
                              key={cal.dateStr}
                              className={[styles.cell, colBg(cal), monthStartCls(cal, i), has ? "" : styles.cellFree].join(" ")}
                              style={{ gridColumn: i + 2 }}
                              onDoubleClick={() =>
                                !has &&
                                setCreateDefaults({ date: cal.dateStr, endDate: shiftDate(cal.date, 1) })
                              }
                            />
                          );
                        })}
                        {runs.map((run) => renderBar(run, "숙박", `lodge-${li}-${run.idx}`))}
                      </div>
                    );
                  })}
                  <div className={`${styles.row} ${styles.countRow} ${styles.lodgeRow}`} style={gridVars}>
                    <div className={styles.label}>
                      <span className={styles.roomNo}>투숙 인원</span>
                      <span className={styles.lodgeLabelMuted}>4/2/1인실</span>
                    </div>
                    {halfDays.map((cal, i) => {
                      const c4 = getRoomCount(cal.dateStr, "4인실");
                      const c2 = getRoomCount(cal.dateStr, "2인실");
                      const c1 = getRoomCount(cal.dateStr, "1인실");
                      return (
                        <div
                          key={cal.dateStr}
                          className={[styles.count, colBg(cal), monthStartCls(cal, i)].join(" ")}
                          style={{ gridColumn: i + 2 }}
                          onDoubleClick={() =>
                            setCreateDefaults({ date: cal.dateStr, endDate: shiftDate(cal.date, 1) })
                          }
                        >
                          {c4 + c2 + c1 > 0 && `${c4}/${c2}/${c1}`}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              </div>
            </section>
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
