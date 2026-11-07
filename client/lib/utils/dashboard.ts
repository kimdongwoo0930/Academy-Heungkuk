import { CLASSROOM_LIST } from '@/lib/constants/classrooms';
import { Reservation } from '@/types/reservation';

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_COLOR = '#667085';

// toISOString()은 UTC 기준이라 자정 전후로 하루가 어긋나므로 로컬 날짜로 직접 만든다
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function diffDays(a: string, b: string): number {
  return Math.round((parseDateStr(a).getTime() - parseDateStr(b).getTime()) / DAY_MS);
}

export function formatMonthDay(dateStr: string): string {
  const d = parseDateStr(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── 예약 색 ──────────────────────────────────────────────

export interface ChipColor {
  rgb: string; // "194,51,154" — rgba(var(--c), a) 용
  fgLight: string;
  fgDark: string;
}

export function toChipColor(hex: string | null | undefined): ChipColor {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim()) ?? /^#?([0-9a-f]{6})$/i.exec(FALLBACK_COLOR)!;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const dark = (ch: number) => Math.round(ch + (255 - ch) * 0.62);
  const light = (ch: number) => Math.round(ch * 0.5);
  return {
    rgb: `${r},${g},${b}`,
    fgLight: `rgb(${light(r)},${light(g)},${light(b)})`,
    fgDark: `rgb(${dark(r)},${dark(g)},${dark(b)})`,
  };
}

// ── 다가오는 일정 ────────────────────────────────────────

export interface Lodging {
  room4: number;
  room2: number;
  room1: number;
}

export interface BookingCard {
  key: string;
  reservationId: number;
  org: string;
  place: string;
  colorCode: string;
  dayNo: number; // 1 = 첫날
  endDate: string | null; // 연박일 때만 (첫날 표시용)
  hasClassroom: boolean;
  lodging: Lodging | null;
}

export interface UpcomingDay {
  date: string;
  cards: BookingCard[];
}

const classroomNameByCode = new Map<string, string>(CLASSROOM_LIST.map((c) => [c.code, c.name]));

export const classroomLabel = (code: string) => classroomNameByCode.get(code) ?? code;

export function countLodging(rooms: Reservation['rooms'], dateStr: string): Lodging {
  const result: Lodging = { room4: 0, room2: 0, room1: 0 };
  for (const rm of rooms ?? []) {
    if (String(rm.reservedDate) !== dateStr) continue;
    if (rm.roomType === '4인실') result.room4++;
    else if (rm.roomType === '2인실') result.room2++;
    else if (rm.roomType === '1인실') result.room1++;
  }
  return result;
}

function placeLabel(codes: string[], hasAnyRoom: boolean): string {
  if (codes.length > 0) {
    const first = classroomNameByCode.get(codes[0]) ?? codes[0];
    return codes.length > 1 ? `${first} 외 ${codes.length - 1}` : first;
  }
  return hasAnyRoom ? '객실만 이용' : '강의실 미지정';
}

const isActive = (r: Reservation) => r.status !== '취소';

export function buildUpcomingDays(reservations: Reservation[], from: Date, dayCount = 7): UpcomingDay[] {
  const active = reservations.filter(isActive).sort((a, b) =>
    a.startDate === b.startDate ? a.id - b.id : a.startDate < b.startDate ? -1 : 1,
  );

  return Array.from({ length: dayCount }, (_, i) => {
    const date = toDateStr(addDays(from, i));
    const cards: BookingCard[] = [];

    for (const r of active) {
      if (r.startDate > date || r.endDate < date) continue;

      const dayNo = diffDays(date, r.startDate) + 1;
      const codes = (r.classrooms ?? []).filter((c) => String(c.reservedDate) === date).map((c) => c.classroomName);
      const lodging = countLodging(r.rooms, date);
      const hasLodging = lodging.room4 + lodging.room2 + lodging.room1 > 0;

      cards.push({
        key: `${r.id}-${date}`,
        reservationId: r.id,
        org: r.organization,
        place: placeLabel(codes, (r.rooms ?? []).length > 0),
        colorCode: r.colorCode,
        dayNo,
        endDate: r.endDate !== r.startDate ? r.endDate : null,
        hasClassroom: codes.length > 0,
        lodging: hasLodging ? lodging : null,
      });
    }

    return { date, cards };
  });
}

// "다음 7일 예정" KPI — 대관 예약 건수. 이어지는 날(2일차~)과 객실만 쓰는 예약은 제외
export function countUpcomingBookings(days: UpcomingDay[]): number {
  return days.reduce((sum, day) => sum + day.cards.filter((c) => c.dayNo === 1 && c.hasClassroom).length, 0);
}

// ── 오늘 숙박 / 식사 ─────────────────────────────────────

export interface LodgingGroup {
  id: number;
  org: string;
  colorCode: string;
}

export interface TodayLodgingSummary {
  groups: LodgingGroup[];
  lodging: Lodging;
}

export function summarizeTodayLodging(reservations: Reservation[], today: string): TodayLodgingSummary {
  const lodging: Lodging = { room4: 0, room2: 0, room1: 0 };
  const groups: LodgingGroup[] = [];
  for (const r of reservations.filter(isActive)) {
    const l = countLodging(r.rooms, today);
    if (l.room4 + l.room2 + l.room1 === 0) continue;
    lodging.room4 += l.room4;
    lodging.room2 += l.room2;
    lodging.room1 += l.room1;
    groups.push({ id: r.id, org: r.organization, colorCode: r.colorCode });
  }
  return { groups, lodging };
}

export interface TodayMealSummary {
  breakfast: number;
  lunch: number;
  dinner: number;
}

export function summarizeTodayMeals(reservations: Reservation[], today: string): TodayMealSummary {
  const sum: TodayMealSummary = { breakfast: 0, lunch: 0, dinner: 0 };
  for (const r of reservations.filter(isActive)) {
    for (const m of r.meals ?? []) {
      if (String(m.reservedDate) !== today) continue;
      sum.breakfast += m.breakfast ?? 0;
      sum.lunch += m.lunch ?? 0;
      sum.dinner += m.dinner ?? 0;
    }
  }
  return sum;
}
