import {
  CellDef,
  FLOOR_GRID_COLS,
  FLOOR_GRID_ROWS,
  FLOOR_LAYOUT_1F,
  FLOOR_LAYOUT_2F,
  ROOM_INFO,
  ROOM_TYPES,
  RoomType,
} from "@/lib/constants/rooms";
import { Reservation, RoomReservation } from "@/types/reservation";

// ── 공통: 월 달력 날짜 목록 생성 ────────────────────────────────────────────

interface CalDay {
  date: Date;
  dateStr: string;
  isCurrent: boolean;
}

function buildCalDays(year: number, month: number): CalDay[] {
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
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ date: d, dateStr, isCurrent: d.getMonth() === month });
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const PRINT_WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function isWeekendDay(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function calThStyle(cal: CalDay) {
  if (!cal.isCurrent) return "background:#f0f0f0;color:#aaa;";
  if (isWeekendDay(cal.date)) return "background:#fff5f5;color:#e53e3e;";
  return "";
}

function calTdStyle(cal: CalDay) {
  if (!cal.isCurrent) return "background:#f8f8f8;";
  if (isWeekendDay(cal.date)) return "background:#fff8f8;";
  return "";
}

const STATUS_COLOR_PRINT = (status: string) =>
  status === "확정" ? "#dc2626" : "#9ca3af";

const LEGEND_HTML =
  `<div class="legend">` +
  `<span class="legend-item"><span class="legend-dot" style="background:#dc2626"></span>확정</span>` +
  `<span class="legend-item"><span class="legend-dot" style="background:#9ca3af"></span>예약 / 문의</span>` +
  `</div>`;

const MEAL_LEGEND_HTML =
  `<div class="legend">` +
  `<span class="legend-item"><span class="legend-dot" style="background:#dc2626"></span>확정</span>` +
  `<span class="legend-item"><span class="legend-dot" style="background:#9ca3af"></span>예약 / 문의</span>` +
  `<span class="legend-item"><span class="legend-dot" style="background:#e67e22"></span>특식(확정)</span>` +
  `<span class="legend-item"><span class="legend-dot" style="background:#ccc"></span>특식(예약/문의)</span>` +
  `</div>`;

const TABLE_COMMON_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Pretendard', 'Apple SD Gothic Neo', Arial, sans-serif; font-size: 11px;
         padding: 8mm 10mm; color: #111; background: #fff; }
  h2 { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
  .legend { display: flex; gap: 14px; margin-bottom: 10px; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #444; }
  .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; display: inline-block; }
  .half-block { margin-bottom: 20px; padding-top: 16px; border-top: 2px solid #d1d5db; }
  .half-block:first-of-type { border-top: none; padding-top: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; table-layout: fixed; }
  th, td { border: 1px solid #ddd; text-align: center; padding: 2px 1px; vertical-align: middle; }
  .th-org { width: 80px; background: #f5f5f5; font-weight: 700; }
  .th-total { width: 36px; background: #f5f5f5; font-weight: 700; }
  .sub-th { font-size: 8px; background: #fafafa; padding: 2px; }
  .date-num { font-size: 10px; font-weight: 700; }
  .day-label { font-size: 8px; color: #666; }
  .td-org { text-align: left; padding: 3px 6px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .total-cell { font-size: 10px; font-weight: 700; }
  .total-row td { background: #f0f6ff; }
  .total-sub { font-size: 10px; font-weight: 700; background: #f0f6ff; }
  .total-label { font-weight: 700; background: #f0f6ff; }
  .empty-cell { padding: 12px; color: #999; }
  .month-summary { margin-top: 8px; padding: 6px 12px; background: #f5f5f5;
                   border-radius: 4px; font-size: 12px; }
  @page { size: A3 landscape; margin: 8mm 10mm; }
  @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
`;

// ── rooms.ts에서 레이아웃 import ──────────────────────────────────────────
// CellDef, FLOOR_LAYOUT_1F, FLOOR_LAYOUT_2F, FLOOR_GRID_COLS, FLOOR_GRID_ROWS는 위에서 import
const LAYOUT = FLOOR_LAYOUT_1F;

const TYPE_COLOR: Record<string, string> = {
  "1인실": "#EC008C",
  "2인실": "#0087D4",
  "4인실": "#F5A623",
};

// ── 공통 유틸 ──────────────────────────────────────────────────────────────

function nextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
function withDay(dateStr: string): string {
  const d = new Date(dateStr);
  return `${dateStr} (${DAY_NAMES[d.getDay()]})`;
}

function openAndPrint(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=900,height=720");
  if (!win) {
    alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
    URL.revokeObjectURL(url);
    return;
  }
  win.addEventListener("load", () => {
    win.print();
    URL.revokeObjectURL(url);
  });
}

// 도면 그리드 HTML 생성 (한 날짜)
function buildFloorGridHtml(
  assignedSet: Set<string>,
  cellPx = 46,
  halfRowPx = 22,
): string {
  const gap = 3;
  const cells = LAYOUT.map((cell) => {
    const gridRow = `${cell.row} / span 2`;
    const gridCol = cell.colSpan
      ? `${cell.col} / span ${cell.colSpan}`
      : `${cell.col}`;

    if (cell.isLabel) {
      return `<div class="floor-label" style="grid-row:${gridRow};grid-column:${gridCol}">${cell.id}</div>`;
    }

    const info = ROOM_INFO[cell.id];
    if (!info) return "";
    const assigned = assignedSet.has(cell.id);
    const color = TYPE_COLOR[info.type] ?? "#ccc";
    const bg = assigned ? color : "#d4d4d4";
    const border = assigned ? color : "#aaa";
    const numColor = assigned ? "#fff" : "#555";
    const capColor = assigned ? "rgba(255,255,255,0.85)" : "#777";

    return `<div class="room-cell" style="
      grid-row:${gridRow};grid-column:${gridCol};
      background:${bg};border:2px solid ${border}">
      <span class="cell-num" style="color:${numColor}">${cell.id}호</span>
      <span class="cell-cap" style="color:${capColor}">${info.cap}인</span>
    </div>`;
  }).join("");

  return `
  <div class="floor-grid" style="
    display:grid;
    gap:${gap}px;
    grid-template-columns:repeat(${FLOOR_GRID_COLS},${cellPx}px);
    grid-template-rows:repeat(${FLOOR_GRID_ROWS},${halfRowPx}px);
  ">${cells}</div>`;
}

// 도면 그리드 HTML 생성 (업체 색상별 — 숙박 현황 뷰용)
function buildFloorGridHtmlColored(
  roomColors: Record<string, string>,
  cellPx = 46,
  halfRowPx = 22,
): string {
  const gap = 3;
  const cells = LAYOUT.map((cell) => {
    const gridRow = `${cell.row} / span 2`;
    const gridCol = cell.colSpan
      ? `${cell.col} / span ${cell.colSpan}`
      : `${cell.col}`;

    if (cell.isLabel) {
      return `<div class="floor-label" style="grid-row:${gridRow};grid-column:${gridCol}">${cell.id}</div>`;
    }

    const info = ROOM_INFO[cell.id];
    if (!info) return "";
    const color = roomColors[cell.id];
    const bg = color ?? "#d4d4d4";
    const border = color ?? "#aaa";
    const numColor = color ? "#fff" : "#555";
    const capColor = color ? "rgba(255,255,255,0.85)" : "#777";

    return `<div class="room-cell" style="
      grid-row:${gridRow};grid-column:${gridCol};
      background:${bg};border:2px solid ${border}">
      <span class="cell-num" style="color:${numColor}">${cell.id}호</span>
      <span class="cell-cap" style="color:${capColor}">${info.cap}인</span>
    </div>`;
  }).join("");

  return `
  <div class="floor-grid" style="
    display:grid;
    gap:${gap}px;
    grid-template-columns:repeat(${FLOOR_GRID_COLS},${cellPx}px);
    grid-template-rows:repeat(${FLOOR_GRID_ROWS},${halfRowPx}px);
  ">${cells}</div>`;
}

// ── 숙박 현황 뷰 출력 (업체 색상 기준, 날짜 클릭 모달용) ────────────────────

export function printRoomViewForDate(
  date: string,
  occupiedRooms: string[],
  roomColors: Record<string, string>,
  orgLegend: { color: string; organization: string }[],
) {
  const legend =
    orgLegend
      .map(
        ({ color, organization }) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${color}"></span>
      <span>${organization}</span>
    </div>`,
      )
      .join("") +
    `<div class="legend-item">
      <span class="legend-dot" style="background:#d4d4d4;border:1px solid #aaa"></span>
      <span>미배정</span>
    </div>`;

  const html = `<!DOCTYPE html><html><head>
  <meta charset="UTF-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/static/pretendard.css">
  <title>숙소 현황 – ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Apple SD Gothic Neo', Arial, sans-serif; font-size: 13px;
           padding: 14mm 12mm; color: #111; background: #fff; }
    h2 { font-size: 20px; font-weight: 700; margin-bottom: 3px; }
    .sub { font-size: 12px; color: #777; margin-bottom: 12px; }
    .legend { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #555; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .floor-grid { margin: 0 auto 14px; width: fit-content; }
    .room-cell { display: flex; flex-direction: column; align-items: center;
                 justify-content: center; border-radius: 4px; gap: 1px; }
    .cell-num { font-size: 11px; font-weight: 700; line-height: 1; }
    .cell-cap { font-size: 9px; font-weight: 600; line-height: 1; }
    .floor-label { display: flex; align-items: center; justify-content: center;
                   font-size: 9px; color: #888; border: 1px dashed #ddd;
                   border-radius: 4px; background: #fafafa; }
    .date-heading { font-size: 28px; font-weight: 700; text-align: center;
                    margin: 8px 0 14px; color: #111; letter-spacing: 1px; }
    .summary { margin-top: 10px; padding: 8px 14px; background: #f5f5f5;
               border-radius: 6px; font-size: 13px; color: #333; text-align: center; }
    @page { size: A4 landscape; margin: 10mm 12mm; }
    @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  </style>
  </head><body>
  <h2>숙소 현황</h2>
  <div class="sub">숙소 배정표</div>
  <div class="date-heading">${withDay(date)} ~ ${withDay(nextDay(date))}</div>
  <div class="legend">${legend}</div>
  ${buildFloorGridHtmlColored(roomColors)}
  <div class="summary">사용중 <strong>${occupiedRooms.length}</strong>실</div>
  <script>window.onafterprint = function(){ window.close(); }</script>
  </body></html>`;

  openAndPrint(html);
}

// ── 일별 숙소 배정표 ────────────────────────────────────────────────────────

export function printRoomTableForDate(
  date: string,
  rooms: RoomReservation[],
  organization: string,
) {
  const assigned = rooms.filter((r) => r.reservedDate === date);
  const assignedSet = new Set(assigned.map((r) => r.roomNumber));

  const count = (type: string) =>
    assigned.filter((r) => ROOM_INFO[r.roomNumber]?.type === type).length;

  const legend = (Object.entries(TYPE_COLOR) as [string, string][])
    .map(
      ([type, color]) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${color}"></span>
      <span>${type} ${count(type) > 0 ? `(${count(type)}실)` : ""}</span>
    </div>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><head>
  <meta charset="UTF-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/static/pretendard.css">
  <title>숙소 배정표 – ${date}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Apple SD Gothic Neo', Arial, sans-serif; font-size: 13px;
           padding: 14mm 12mm; color: #111; background: #fff; }
    h2 { font-size: 20px; font-weight: 700; margin-bottom: 3px; }
    .sub { font-size: 12px; color: #777; margin-bottom: 12px; }
    .legend { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #555; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .floor-grid { margin: 0 auto 14px; width: fit-content; }
    .room-cell { display: flex; flex-direction: column; align-items: center;
                 justify-content: center; border-radius: 4px; gap: 1px; }
    .cell-num { font-size: 11px; font-weight: 700; line-height: 1; }
    .cell-cap { font-size: 9px; font-weight: 600; line-height: 1; }
    .floor-label { display: flex; align-items: center; justify-content: center;
                   font-size: 9px; color: #888; border: 1px dashed #ddd;
                   border-radius: 4px; background: #fafafa; }
    .date-heading { font-size: 28px; font-weight: 700; text-align: center;
                    margin: 8px 0 14px; color: #111; letter-spacing: 1px; }
    .summary { margin-top: 10px; padding: 8px 14px; background: #f5f5f5;
               border-radius: 6px; font-size: 13px; color: #333; text-align: center; }
    @page { size: A4 landscape; margin: 10mm 12mm; }
    @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  </style>
  </head><body>
  <h2>${organization}</h2>
  <div class="sub">숙소 배정표</div>
  <div class="date-heading">${date}</div>
  <div class="legend">${legend}
    <div class="legend-item">
      <span class="legend-dot" style="background:#d4d4d4;border:1px solid #aaa"></span>
      <span>미배정</span>
    </div>
  </div>
  ${buildFloorGridHtml(assignedSet)}
  <div class="summary">
    1인실 <strong>${count("1인실")}</strong>실 &nbsp;·&nbsp;
    2인실 <strong>${count("2인실")}</strong>실 &nbsp;·&nbsp;
    4인실 <strong>${count("4인실")}</strong>실 &nbsp;·&nbsp;
    합계 <strong>${assigned.length}</strong>실
  </div>
  <script>window.onafterprint = function(){ window.close(); }</script>
  </body></html>`;

  openAndPrint(html);
}

// ── 통합 숙소 배정표 (날짜별 도면 나열) ────────────────────────────────────

export function printRoomTableIntegrated(
  dates: string[],
  rooms: RoomReservation[],
  organization: string,
) {
  if (dates.length === 0) {
    alert("날짜가 없습니다.");
    return;
  }
  if (rooms.length === 0) {
    alert("배정된 호실이 없습니다.");
    return;
  }

  // ── 날짜별 호실 키 생성 (정렬된 쉼표 문자열) ──
  const keyOf = (date: string) =>
    rooms
      .filter((r) => r.reservedDate === date)
      .map((r) => r.roomNumber)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .join(",");

  // ── 연속된 날짜 중 호실이 같은 것끼리 그룹화 ──
  type Group = { startDate: string; endDate: string; key: string };
  const groups: Group[] = [];
  for (const date of dates) {
    const key = keyOf(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.endDate = date;
    } else {
      groups.push({ startDate: date, endDate: date, key });
    }
  }

  const cellPx = 52;
  const halfRowPx = 24;

  const legendHtml = `<div class="legend">
    ${(Object.entries(TYPE_COLOR) as [string, string][])
      .map(
        ([type, color]) =>
          `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span><span>${type} 배정</span></div>`,
      )
      .join("")}
    <div class="legend-item"><span class="legend-dot" style="background:#d4d4d4;border:1px solid #aaa"></span><span>미배정</span></div>
  </div>`;

  const blocks = groups
    .map(({ startDate, endDate, key }) => {
      const assignedSet = new Set(key ? key.split(",") : []);
      const total = assignedSet.size;
      const label = `${withDay(startDate)} ~ ${withDay(nextDay(endDate))}`;
      return `
    <div class="date-block">
      <div class="block-header">
        <h2>${organization}</h2>
        <div class="sub">통합 숙소 배정표 &nbsp;|&nbsp; ${withDay(dates[0])} ~ ${withDay(nextDay(dates[dates.length - 1]))}</div>
        ${legendHtml}
      </div>
      <div class="date-title">${label} <span class="date-count">(${total}실)</span></div>
      ${buildFloorGridHtml(assignedSet, cellPx, halfRowPx)}
    </div>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head>
  <meta charset="UTF-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/static/pretendard.css">
  <title>통합 숙소 배정표 – ${organization}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Apple SD Gothic Neo', Arial, sans-serif; font-size: 13px;
           padding: 0 10mm; color: #111; background: #fff; }
    h2 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .sub { font-size: 12px; color: #777; margin-bottom: 8px; }
    .legend { display: flex; gap: 14px; margin-bottom: 0; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #555; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .date-block { break-after: page; display: flex; flex-direction: column; align-items: center; padding-top: 10mm; }
    .date-title { font-size: 28px; font-weight: 700; text-align: center;
                  margin: 30px 0 100px; color: #111; letter-spacing: 1px; width: 100%; }
    .date-count { font-size: 16px; font-weight: 400; color: #555; }
    .block-header { width: 100%; }
    .room-cell { display: flex; flex-direction: column; align-items: center;
                 justify-content: center; border-radius: 4px; gap: 1px; }
    .cell-num { font-size: 11px; font-weight: 700; line-height: 1; }
    .cell-cap { font-size: 9px; font-weight: 600; line-height: 1; }
    .floor-label { display: flex; align-items: center; justify-content: center;
                   font-size: 9px; color: #888; border: 1px dashed #ddd;
                   border-radius: 4px; background: #fafafa; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
  </style>
  </head><body>
  ${blocks}
  <script>window.onafterprint = function(){ window.close(); }</script>
  </body></html>`;

  openAndPrint(html);
}

// ── 식수 현황 월별 인쇄 ────────────────────────────────────────────────────

export function printMealTable(
  year: number,
  month: number,
  reservations: Reservation[],
) {
  const calDays = buildCalDays(year, month);
  const halves: CalDay[][] = [];
  for (let i = 0; i < calDays.length; i += 7)
    halves.push(calDays.slice(i, i + 7));

  const displayedDates = new Set(calDays.map((c) => c.dateStr));
  const activeRes = reservations.filter((r) => {
    if (r.status === "취소") return false;
    return r.meals?.some((m) => displayedDates.has(String(m.reservedDate)));
  });

  const getOrgMeal = (resId: number, dateStr: string) => {
    const res = reservations.find((r) => r.id === resId);
    return res?.meals?.find((m) => String(m.reservedDate) === dateStr) ?? null;
  };

  const getDayMealTotal = (
    dateStr: string,
    type: "breakfast" | "lunch" | "dinner",
  ) => {
    let total = 0;
    activeRes.forEach((r) => {
      const meal = getOrgMeal(r.id, dateStr);
      if (meal) total += meal[type];
    });
    return total;
  };

  const halfTablesHtml = halves
    .map((halfDays) => {
      const halfActiveRes = activeRes.filter((res) =>
        halfDays.some((cal) => {
          const meal = getOrgMeal(res.id, cal.dateStr);
          return (
            meal && (meal.breakfast > 0 || meal.lunch > 0 || meal.dinner > 0)
          );
        }),
      );

      const thead =
        `<tr><th class="th-org" rowspan="2">단체명</th>` +
        halfDays
          .map(
            (cal) =>
              `<th colspan="3" style="${calThStyle(cal)}">` +
              `<div class="date-num">${cal.date.getDate()}일</div>` +
              `<div class="day-label">${PRINT_WEEK_DAYS[cal.date.getDay()]}</div></th>`,
          )
          .join("") +
        `<th class="th-total" rowspan="2">식수계</th></tr>` +
        `<tr>` +
        halfDays
          .flatMap((cal) => [
            `<th class="sub-th" style="${calThStyle(cal)}">조</th>`,
            `<th class="sub-th" style="${calThStyle(cal)}">중</th>`,
            `<th class="sub-th" style="${calThStyle(cal)}">석</th>`,
          ])
          .join("") +
        `</tr>`;

      let bodyRows = "";
      if (halfActiveRes.length === 0) {
        bodyRows = `<tr><td colspan="${1 + halfDays.length * 3 + 1}" class="empty-cell">식수 예약이 없습니다.</td></tr>`;
      } else {
        bodyRows = halfActiveRes
          .map((res) => {
            const halfTotal = halfDays.reduce((sum, cal) => {
              const meal = getOrgMeal(res.id, cal.dateStr);
              return (
                sum + (meal ? meal.breakfast + meal.lunch + meal.dinner : 0)
              );
            }, 0);
            const isConfirmed = res.status === "확정";
            const cells = halfDays
              .flatMap((cal) => {
                const meal = getOrgMeal(res.id, cal.dateStr);
                const b = meal?.breakfast ?? 0;
                const l = meal?.lunch ?? 0;
                const d = meal?.dinner ?? 0;
                const sb = meal?.specialBreakfast ?? false;
                const sl = meal?.specialLunch ?? false;
                const sd = meal?.specialDinner ?? false;
                const statusColor = STATUS_COLOR_PRINT(res.status);
                const mealSpan = (count: number, isSpecial: boolean) => {
                  if (count === 0) return "";
                  if (isSpecial) {
                    const bg = isConfirmed ? "#e67e22" : "#ccc";
                    return `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 2px;background:${bg};color:#fff;border-radius:3px;font-size:9px;font-weight:700;">${count}</span>`;
                  }
                  return `<span style="font-weight:700;color:${statusColor}">${count}</span>`;
                };
                return [
                  `<td class="meal-cell" style="${calTdStyle(cal)}">${mealSpan(b, sb)}</td>`,
                  `<td class="meal-cell" style="${calTdStyle(cal)}">${mealSpan(l, sl)}</td>`,
                  `<td class="meal-cell" style="${calTdStyle(cal)}">${mealSpan(d, sd)}</td>`,
                ];
              })
              .join("");
            return (
              `<tr><td class="td-org" style="border-left:4px solid ${res.colorCode};">${res.organization}</td>` +
              cells +
              `<td class="total-cell">${halfTotal > 0 ? halfTotal : ""}</td></tr>`
            );
          })
          .join("");

        const grandTotal = halfDays.reduce(
          (s, cal) =>
            s +
            getDayMealTotal(cal.dateStr, "breakfast") +
            getDayMealTotal(cal.dateStr, "lunch") +
            getDayMealTotal(cal.dateStr, "dinner"),
          0,
        );
        const totalCells = halfDays
          .flatMap((cal) => {
            const b = getDayMealTotal(cal.dateStr, "breakfast");
            const l = getDayMealTotal(cal.dateStr, "lunch");
            const d = getDayMealTotal(cal.dateStr, "dinner");
            return [
              `<td class="total-sub" style="${calTdStyle(cal)}">${b > 0 ? b : ""}</td>`,
              `<td class="total-sub" style="${calTdStyle(cal)}">${l > 0 ? l : ""}</td>`,
              `<td class="total-sub" style="${calTdStyle(cal)}">${d > 0 ? d : ""}</td>`,
            ];
          })
          .join("");
        bodyRows +=
          `<tr class="total-row"><td class="total-label">합계</td>` +
          totalCells +
          `<td class="total-cell">${grandTotal > 0 ? grandTotal : ""}</td></tr>`;
      }

      return `<div class="half-block"><table><thead>${thead}</thead><tbody>${bodyRows}</tbody></table></div>`;
    })
    .join("");

  const monthDates = calDays.filter((c) => c.isCurrent);
  const monthB = monthDates.reduce(
    (s, c) => s + getDayMealTotal(c.dateStr, "breakfast"),
    0,
  );
  const monthL = monthDates.reduce(
    (s, c) => s + getDayMealTotal(c.dateStr, "lunch"),
    0,
  );
  const monthD = monthDates.reduce(
    (s, c) => s + getDayMealTotal(c.dateStr, "dinner"),
    0,
  );
  const monthTotal = monthB + monthL + monthD;

  const mealHtml =
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/static/pretendard.css">` +
    `<title>${year}년 ${month + 1}월 식수 현황</title>` +
    `<style>${TABLE_COMMON_CSS}.meal-cell{font-size:10px;}</style></head><body>` +
    `<h2>${year}년 ${month + 1}월 식수 현황</h2>` +
    MEAL_LEGEND_HTML +
    halfTablesHtml +
    `<div class="month-summary"><strong>${year}년 ${month + 1}월 합계</strong>&nbsp;&nbsp;` +
    `조식 <strong>${monthB}</strong>&nbsp;·&nbsp;` +
    `중식 <strong>${monthL}</strong>&nbsp;·&nbsp;` +
    `석식 <strong>${monthD}</strong>&nbsp;·&nbsp;` +
    `합계 <strong>${monthTotal}</strong></div>` +
    `<script>window.onafterprint=function(){window.close();}</script>` +
    `</body></html>`;

  openAndPrint(mealHtml);
}

// ── 숙박 현황 월별 인쇄 ────────────────────────────────────────────────────


export function printAccommodationTable(
  year: number,
  month: number,
  reservations: Reservation[],
) {
  const calDays = buildCalDays(year, month);
  const halves: CalDay[][] = [];
  for (let i = 0; i < calDays.length; i += 7)
    halves.push(calDays.slice(i, i + 7));

  const displayedDates = new Set(calDays.map((c) => c.dateStr));
  const activeRes = reservations.filter((r) => {
    if (r.status === "취소") return false;
    return r.rooms?.some((rm) => displayedDates.has(String(rm.reservedDate)));
  });

  const getRoomsOnDate = (resId: number, dateStr: string) => {
    const res = reservations.find((r) => r.id === resId);
    return (
      res?.rooms?.filter((rm) => String(rm.reservedDate) === dateStr) ?? []
    );
  };

  const getDayTypeTotal = (dateStr: string, type: RoomType) => {
    let total = 0;
    activeRes.forEach((r) => {
      total += getRoomsOnDate(r.id, dateStr).filter(
        (rm) => rm.roomType === type,
      ).length;
    });
    return total;
  };

  const getDayRoomTotal = (dateStr: string) =>
    ROOM_TYPES.reduce((s, t) => s + getDayTypeTotal(dateStr, t), 0);

  const halfTablesHtml = halves
    .map((halfDays) => {
      const halfActiveRes = activeRes.filter((res) =>
        halfDays.some((cal) => getRoomsOnDate(res.id, cal.dateStr).length > 0),
      );

      const thead =
        `<tr><th class="th-org" rowspan="2">단체명</th>` +
        halfDays
          .map(
            (cal) =>
              `<th colspan="3" style="${calThStyle(cal)}">` +
              `<div class="date-num">${cal.date.getDate()}일</div>` +
              `<div class="day-label">${PRINT_WEEK_DAYS[cal.date.getDay()]}</div></th>`,
          )
          .join("") +
        `<th class="th-total" rowspan="2">합계</th></tr>` +
        `<tr>` +
        halfDays
          .flatMap((cal) => [
            `<th class="sub-th" style="${calThStyle(cal)}">4인</th>`,
            `<th class="sub-th" style="${calThStyle(cal)}">2인</th>`,
            `<th class="sub-th" style="${calThStyle(cal)}">1인</th>`,
          ])
          .join("") +
        `</tr>`;

      let bodyRows = "";
      if (halfActiveRes.length === 0) {
        bodyRows = `<tr><td colspan="${1 + halfDays.length * 3 + 1}" class="empty-cell">숙박 예약이 없습니다.</td></tr>`;
      } else {
        bodyRows = halfActiveRes
          .map((res) => {
            const halfTotal = halfDays.reduce(
              (sum, cal) => sum + getRoomsOnDate(res.id, cal.dateStr).length,
              0,
            );
            const cls = STATUS_COLOR_PRINT(res.status);
            const cells = halfDays
              .flatMap((cal) => {
                const rooms = getRoomsOnDate(res.id, cal.dateStr);
                const c4 = rooms.filter((r) => r.roomType === "4인실").length;
                const c2 = rooms.filter((r) => r.roomType === "2인실").length;
                const c1 = rooms.filter((r) => r.roomType === "1인실").length;
                const span = (n: number) =>
                  n > 0
                    ? `<span style="font-weight:700;color:${cls}">${n}</span>`
                    : "";
                return [
                  `<td class="room-cell" style="${calTdStyle(cal)}">${span(c4)}</td>`,
                  `<td class="room-cell" style="${calTdStyle(cal)}">${span(c2)}</td>`,
                  `<td class="room-cell" style="${calTdStyle(cal)}">${span(c1)}</td>`,
                ];
              })
              .join("");
            return (
              `<tr><td class="td-org" style="border-left:4px solid ${res.colorCode};">${res.organization}</td>` +
              cells +
              `<td class="total-cell">${halfTotal > 0 ? halfTotal : ""}</td></tr>`
            );
          })
          .join("");

        const grandTotal = halfDays.reduce(
          (s, cal) => s + getDayRoomTotal(cal.dateStr),
          0,
        );
        const totalCells = halfDays
          .flatMap((cal) => {
            const t4 = getDayTypeTotal(cal.dateStr, "4인실");
            const t2 = getDayTypeTotal(cal.dateStr, "2인실");
            const t1 = getDayTypeTotal(cal.dateStr, "1인실");
            return [
              `<td class="total-sub" style="${calTdStyle(cal)}">${t4 > 0 ? t4 : ""}</td>`,
              `<td class="total-sub" style="${calTdStyle(cal)}">${t2 > 0 ? t2 : ""}</td>`,
              `<td class="total-sub" style="${calTdStyle(cal)}">${t1 > 0 ? t1 : ""}</td>`,
            ];
          })
          .join("");
        bodyRows +=
          `<tr class="total-row"><td class="total-label">합계</td>` +
          totalCells +
          `<td class="total-cell">${grandTotal > 0 ? grandTotal : ""}</td></tr>`;
      }

      return `<div class="half-block"><table><thead>${thead}</thead><tbody>${bodyRows}</tbody></table></div>`;
    })
    .join("");

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

  const accomHtml =
    `<!DOCTYPE html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/static/pretendard.css">` +
    `<title>${year}년 ${month + 1}월 숙박 현황</title>` +
    `<style>${TABLE_COMMON_CSS}.room-cell{font-size:10px;}</style></head><body>` +
    `<h2>${year}년 ${month + 1}월 숙박 현황</h2>` +
    LEGEND_HTML +
    halfTablesHtml +
    `<div class="month-summary"><strong>${year}년 ${month + 1}월 합계</strong>&nbsp;&nbsp;` +
    `4인실 <strong>${month4}</strong>&nbsp;·&nbsp;` +
    `2인실 <strong>${month2}</strong>&nbsp;·&nbsp;` +
    `1인실 <strong>${month1}</strong>&nbsp;·&nbsp;` +
    `합계 <strong>${monthTotal}</strong></div>` +
    `<script>window.onafterprint=function(){window.close();}</script>` +
    `</body></html>`;

  openAndPrint(accomHtml);
}

// ── 일정 현황 주차별 인쇄 ────────────────────────────────────────────────────

const SCHED_CLASSROOM_GROUPS = [
  { type: "대강의실", bg: "#fffde6", rooms: [{ id: "105", cap: 120 }] },
  {
    type: "중강의실",
    bg: "#fffde6",
    rooms: [
      { id: "201", cap: 70 },
      { id: "203", cap: 50 },
      { id: "204", cap: 50 },
    ],
  },
  {
    type: "소강의실",
    bg: "#fffde6",
    rooms: [
      { id: "101", cap: 30 },
      { id: "102", cap: 20 },
      { id: "103", cap: 30 },
      { id: "202", cap: 30 },
    ],
  },
  {
    type: "분임실",
    bg: "#e8f5e9",
    rooms: [
      { id: "106", cap: 12 },
      { id: "107", cap: 12 },
      { id: "205", cap: 12 },
      { id: "206", cap: 12 },
    ],
  },
  {
    type: "다목적실",
    bg: "#e3f0fb",
    rooms: [
      { id: "A", cap: 80 },
      { id: "B", cap: 40 },
    ],
  },
];

const SCHED_WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function printSchedulerWeekly(
  year: number,
  month: number,
  reservations: Reservation[],
) {
  // 달력 날짜 생성 (월요일 시작)
  const firstDayMon = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0..Sun=6
  const lastDate = new Date(year, month + 1, 0).getDate();
  const lastDayMon = (new Date(year, month + 1, 0).getDay() + 6) % 7; // Mon=0..Sun=6

  type SchedDay = { date: Date; dateStr: string; isCurrent: boolean };
  const calDays: SchedDay[] = [];

  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  for (let i = firstDayMon - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    calDays.push({ date: d, dateStr: toStr(d), isCurrent: false });
  }
  for (let i = 1; i <= lastDate; i++) {
    const d = new Date(year, month, i);
    calDays.push({ date: d, dateStr: toStr(d), isCurrent: true });
  }
  const trailing = lastDayMon === 6 ? 0 : 6 - lastDayMon;
  for (let i = 1; i <= trailing; i++) {
    const d = new Date(year, month + 1, i);
    calDays.push({ date: d, dateStr: toStr(d), isCurrent: false });
  }

  // 7일씩 주차 분리 (월요일 시작)
  const weeks: SchedDay[][] = [];
  for (let i = 0; i < calDays.length; i += 7)
    weeks.push(calDays.slice(i, i + 7));

  const getClassroomRes = (roomId: string, dateStr: string) =>
    reservations.find(
      (r) =>
        r.status !== "취소" &&
        r.classrooms?.some(
          (c) =>
            c.classroomName === roomId && String(c.reservedDate) === dateStr,
        ),
    );

  const thStyle = (cal: SchedDay) => {
    if (!cal.isCurrent) return "background:#f0f0f0;color:#aaa;";
    if (cal.date.getDay() === 0 || cal.date.getDay() === 6)
      return "background:#fff5f5;color:#e53e3e;";
    return "";
  };
  const tdBg = (cal: SchedDay) => {
    if (!cal.isCurrent) return "background:#f8f8f8;";
    if (cal.date.getDay() === 0 || cal.date.getDay() === 6)
      return "background:#fff8f8;";
    return "";
  };

  const weekHtmls = weeks.map((weekDays) => {
    // 강의실 행 (colspan 스패닝 바)
    const classroomRows = SCHED_CLASSROOM_GROUPS.flatMap((group, gi) =>
      group.rooms.map((room, ri) => {
        const isFirst = ri === 0;
        const divider =
          isFirst && gi > 0 ? "border-top:2px solid #bebcbc;" : "";
        const cells: string[] = [];
        let di = 0;
        while (di < weekDays.length) {
          const cal = weekDays[di];
          const res = getClassroomRes(room.id, cal.dateStr);
          const bg = tdBg(cal) || `background:${group.bg};`;
          if (res) {
            let span = 1;
            while (di + span < weekDays.length) {
              const next = weekDays[di + span];
              const nextRes = getClassroomRes(room.id, next.dateStr);
              if (nextRes && nextRes.id === res.id) span++;
              else break;
            }
            const colAttr = span > 1 ? ` colspan="${span}"` : "";
            const bar = `<span style="display:block;background:${res.colorCode};color:#fff;border-radius:2px;padding:1px 4px;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">${res.organization} (${res.people}명)</span>`;
            cells.push(`<td${colAttr} style="${bg}${divider}">${bar}</td>`);
            di += span;
          } else {
            cells.push(`<td style="${bg}${divider}"></td>`);
            di++;
          }
        }

        return (
          `<tr>` +
          (isFirst
            ? `<td rowspan="${group.rooms.length}" style="background:${group.bg};font-weight:700;font-size:15px;${divider}">${group.type}</td>`
            : "") +
          `<td style="background:${group.bg};font-size:15px;${divider}">${/^\d+$/.test(room.id) ? `${room.id}호` : room.id}</td>` +
          `<td style="background:${group.bg};font-size:13px;color:#666;${divider}">${room.cap != null ? `${room.cap}인` : ""}</td>` +
          cells.join("") +
          `</tr>`
        );
      }),
    ).join("");

    // 숙박 레인 패킹
    const weekDateSet = new Set(weekDays.map((d) => d.dateStr));
    const halfRoomRes = reservations.filter(
      (r) =>
        r.status !== "취소" &&
        r.rooms?.some((rm) => weekDateSet.has(String(rm.reservedDate))),
    );
    const lanes: Reservation[][] = [];
    for (const res of halfRoomRes) {
      const resDates = new Set(
        res.rooms?.map((rm) => String(rm.reservedDate)) ?? [],
      );
      let placed = false;
      for (const lane of lanes) {
        const conflict = lane.some((r) =>
          r.rooms?.some((rm) => resDates.has(String(rm.reservedDate))),
        );
        if (!conflict) {
          lane.push(res);
          placed = true;
          break;
        }
      }
      if (!placed) lanes.push([res]);
    }

    const ACCOM_BG = "#fff0f3";
    const accumTdBg = (cal: SchedDay) => {
      if (!cal.isCurrent) return `background:#f4e8ea;`;
      if (cal.date.getDay() === 0 || cal.date.getDay() === 6)
        return `background:#fde8ee;`;
      return `background:${ACCOM_BG};`;
    };

    const RED = "#e53e3e";
    const laneRows = lanes
      .map((lane, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === lanes.length - 1;
        const cells: string[] = [];
        let di = 0;
        while (di < weekDays.length) {
          const cal = weekDays[di];
          const res = lane.find((r) =>
            r.rooms?.some((rm) => String(rm.reservedDate) === cal.dateStr),
          );
          if (res) {
            let span = 1;
            while (di + span < weekDays.length) {
              const next = weekDays[di + span];
              if (
                res.rooms?.some(
                  (rm) => String(rm.reservedDate) === next.dateStr,
                )
              )
                span++;
              else break;
            }
            const colAttr = span > 1 ? ` colspan="${span}"` : "";
            const topB = isFirst ? `border-top:2px solid ${RED};` : "";
            const bottomB = isLast ? `border-bottom:2px solid ${RED};` : "";
            const rightB =
              di + span === weekDays.length
                ? `border-right:2px solid ${RED};`
                : "";
            const bar = `<span style="display:block;background:${res.colorCode};color:#fff;border-radius:2px;padding:1px 4px;font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;">${res.organization} (${res.people}명)</span>`;
            cells.push(
              `<td${colAttr} style="${accumTdBg(cal)}${topB}${bottomB}${rightB}">${bar}</td>`,
            );
            di += span;
          } else {
            const topB = isFirst ? `border-top:2px solid ${RED};` : "";
            const bottomB = isLast ? `border-bottom:2px solid ${RED};` : "";
            const rightB =
              di + 1 === weekDays.length
                ? `border-right:2px solid ${RED};`
                : "";
            cells.push(
              `<td style="${accumTdBg(cal)}${topB}${bottomB}${rightB}"></td>`,
            );
            di++;
          }
        }
        return (
          `<tr>` +
          (isFirst
            ? `<td rowspan="${lanes.length}" style="background:${ACCOM_BG};font-weight:700;font-size:15px;border-top:2px solid ${RED};border-left:2px solid ${RED};border-bottom:2px solid ${RED};">숙박</td>`
            : "") +
          `<td style="background:${ACCOM_BG};${isFirst ? `border-top:2px solid ${RED};` : ""}${isLast ? `border-bottom:2px solid ${RED};` : ""}"></td>` +
          `<td style="background:${ACCOM_BG};${isFirst ? `border-top:2px solid ${RED};` : ""}${isLast ? `border-bottom:2px solid ${RED};` : ""}"></td>` +
          cells.join("") +
          `</tr>`
        );
      })
      .join("");

    const thCells = weekDays
      .map(
        (cal) =>
          `<th style="${thStyle(cal)}"><span class="date-num">${cal.date.getDate()}일</span> <span class="day-label">(${SCHED_WEEK_DAYS[cal.date.getDay()]})</span></th>`,
      )
      .join("");

    return (
      `<div class="week-block">` +
      `<table><colgroup><col style="width:90px"><col style="width:70px"><col style="width:50px">` +
      weekDays.map(() => `<col>`).join("") +
      `</colgroup><thead><tr>` +
      `<th class="th-fixed">구분</th><th class="th-fixed">호실</th><th class="th-fixed">정원</th>` +
      thCells +
      `</tr></thead><tbody>` +
      classroomRows +
      (lanes.length > 0 ? laneRows : "") +
      `</tbody></table></div>`
    );
  });

  // 2주씩 묶어 page-block으로 감싸기 (제목은 페이지당 1개)
  let weekBlocks = "";
  for (let i = 0; i < weekHtmls.length; i += 2) {
    const isLast = i + 2 >= weekHtmls.length;
    weekBlocks += `<div class="page-block${isLast ? " page-last" : ""}">`;
    weekBlocks += `<h2>${year}년 ${month + 1}월 일정 현황</h2>`;
    weekBlocks += weekHtmls[i];
    if (i + 1 < weekHtmls.length) weekBlocks += weekHtmls[i + 1];
    weekBlocks += `</div>`;
  }

  const html =
    `<!DOCTYPE html><html><head>` +
    `<meta charset="UTF-8">` +
    `<meta name="viewport" content="width=1400">` +
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@latest/dist/web/static/pretendard.css">` +
    `<title>${year}년 ${month + 1}월 일정 현황 (주차별)</title>` +
    `<style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Pretendard', 'Apple SD Gothic Neo', Arial, sans-serif; font-size: 9px; color: #111; background: #e8e8e8; display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 20px; }
      .page-block { width: 1000px; background: #fff; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); padding: 10px 20px; }
      .week-block + .week-block { border-top: 4px solid #000000; margin-top: 10px; padding-top: 10px; }
      h2 { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; table-layout: fixed; }
      th, td { border: 1px solid #ddd; text-align: center; padding: 3px 1px; vertical-align: middle; height: 28px; }
      .th-fixed { background: #f5f5f5; font-weight: 700; }
      .total-row td { height: 15px; padding: 1px; font-size: 10px; white-space: nowrap; overflow: hidden; }

      .date-num { font-size: 15px; font-weight: 700; }
      .day-label { font-size: 15px; }
      @page { size: A3 landscape; margin: 2mm 4mm; }
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        html, body { width: 100%; height: auto; background: #fff; padding: 0; gap: 0; display: block; }
        .page-block { page-break-after: always; break-after: page; page-break-inside: avoid; break-inside: avoid; width: 100%; padding: 3mm 6mm; box-shadow: none; border-radius: 0; background: #fff; }
        .page-last { page-break-after: avoid; break-after: avoid; }
        h2 { font-size: 12px; margin-bottom: 2mm; }
      }
    </style></head><body>` +
    weekBlocks +
    `<script>window.onload=function(){window.print();};window.onafterprint=function(){window.close();}</script>` +
    `</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "width=1200,height=860");
  if (!win) {
    alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
    URL.revokeObjectURL(url);
  }
}
