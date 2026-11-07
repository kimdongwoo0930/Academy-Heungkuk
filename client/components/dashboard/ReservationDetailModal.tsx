"use client";

import { STATUS_COLOR } from "@/lib/constants/status";
import {
  classroomLabel,
  countLodging,
  formatMonthDay,
  parseDateStr,
  WEEKDAYS,
} from "@/lib/utils/dashboard";
import { MealReservation, Reservation } from "@/types/reservation";
import { ChevronDown, Mail, Phone, X } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./ReservationDetailModal.module.css";
import RoomFloorView from "./RoomFloorView";

interface Props {
  reservation: Reservation;
  onClose: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const dayLabel = (dateStr: string) =>
  `${formatMonthDay(dateStr)} (${WEEKDAYS[parseDateStr(dateStr).getDay()]})`;

const diffDays = (from: string, to: string) =>
  Math.round(
    (parseDateStr(to).getTime() - parseDateStr(from).getTime()) / DAY_MS,
  );

const slashDate = (dateStr: string) => dateStr.slice(5).replace("-", "/");

const unique = (values: string[]) => [...new Set(values)].sort();

// ── 일자별 이용 내역 ─────────────────────────────────────

interface DayInfo {
  date: string;
  classrooms: string[];
  lodging: {
    room4: number;
    room2: number;
    room1: number;
    numbers: string[];
  } | null;
  meal: MealReservation | null;
}

interface Run {
  start: string;
  end: string;
  days: number;
  info: DayInfo;
}

// 강의실 · 숙박 · 식사가 모두 같은 날을 이어 붙이는 기준
const contentKey = ({ classrooms, lodging, meal }: DayInfo) =>
  JSON.stringify([
    classrooms,
    lodging,
    meal && [
      meal.breakfast,
      meal.lunch,
      meal.dinner,
      !!meal.specialBreakfast,
      !!meal.specialLunch,
      !!meal.specialDinner,
    ],
  ]);

// 날짜순 항목에서 달력상 연속이고 내용이 같은 날들을 한 구간으로 묶는다
function toRuns(days: DayInfo[]): Run[] {
  const runs: Run[] = [];
  let lastKey = "";
  for (const info of days) {
    const key = contentKey(info);
    const last = runs[runs.length - 1];
    if (last && key === lastKey && diffDays(last.end, info.date) === 1) {
      last.end = info.date;
      last.days += 1;
    } else {
      runs.push({ start: info.date, end: info.date, days: 1, info });
    }
    lastKey = key;
  }
  return runs;
}

function buildDays(r: Reservation): DayInfo[] {
  const dates = unique([
    ...(r.classrooms ?? []).map((c) => String(c.reservedDate)),
    ...(r.rooms ?? []).map((c) => String(c.reservedDate)),
    ...(r.meals ?? []).map((c) => String(c.reservedDate)),
  ]);

  return dates.map((date) => {
    const numbers = (r.rooms ?? [])
      .filter((x) => String(x.reservedDate) === date)
      .map((x) => x.roomNumber)
      .sort();
    const l = countLodging(r.rooms, date);
    return {
      date,
      classrooms: (r.classrooms ?? [])
        .filter((c) => String(c.reservedDate) === date)
        .map((c) => classroomLabel(c.classroomName))
        .sort(),
      lodging:
        numbers.length > 0
          ? { room4: l.room4, room2: l.room2, room1: l.room1, numbers }
          : null,
      meal:
        (r.meals ?? []).find((m) => String(m.reservedDate) === date) ?? null,
    };
  });
}

function MealCell({ meal }: { meal: MealReservation | null }) {
  if (!meal) return <span className={styles.dash}>—</span>;
  const special = [
    meal.specialBreakfast && "조식",
    meal.specialLunch && "중식",
    meal.specialDinner && "석식",
  ].filter(Boolean);
  return (
    <>
      {meal.breakfast} · {meal.lunch} · {meal.dinner}
      {special.length > 0 && (
        <span className={styles.sub}>특식 {special.join(" · ")}</span>
      )}
    </>
  );
}

function UsageTable({ r }: { r: Reservation }) {
  const days = buildDays(r);
  const runs = toRuns(days);
  const lodgingRunCount = runs.filter((run) => run.info.lodging).length;

  // 처음에는 모두 접어 두고, 숙박 줄을 누르면 객실 배치도를 펼친다
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const classroomDays = days.filter((d) => d.classrooms.length > 0).length;
  const nights = days.filter((d) => d.lodging).length;
  const mealTotal = (r.meals ?? []).reduce(
    (sum, m) => sum + m.breakfast + m.lunch + m.dinner,
    0,
  );
  const merged = runs.some((run) => run.days > 1);

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.colDate}>
                날짜
              </th>
              <th scope="col">강의실</th>
              <th scope="col">숙박</th>
              <th scope="col" className={styles.colMeal}>
                식사 (조·중·석)
              </th>
            </tr>
          </thead>
          {runs.map((run) => {
            const { classrooms, lodging, meal } = run.info;
            const isOpen = open.has(run.start);
            const panelId = `rooms-${run.start}`;
            return (
              <tbody key={run.start}>
                <tr>
                  <td className={styles.colDate}>
                    <strong>
                      {run.start === run.end
                        ? dayLabel(run.start)
                        : `${dayLabel(run.start)} ~ ${dayLabel(run.end)}`}
                    </strong>
                    <span className={styles.sub}>{run.days}일</span>
                  </td>
                  <td>
                    {classrooms.length > 0 ? (
                      <div className={styles.chips}>
                        {classrooms.map((c) => (
                          <span key={c} className={styles.chip}>
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.dash}>—</span>
                    )}
                  </td>
                  <td>
                    {lodging ? (
                      <button
                        type="button"
                        className={styles.lodgingBtn}
                        onClick={() => toggle(run.start)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={`${dayLabel(run.start)} 배정 객실 ${isOpen ? "접기" : "펼치기"}`}
                      >
                        <span className={styles.pills}>
                          {lodging.room4 > 0 && (
                            <span className={styles.pill}>
                              4인실 {lodging.room4}실
                            </span>
                          )}
                          {lodging.room2 > 0 && (
                            <span className={styles.pill}>
                              2인실 {lodging.room2}실
                            </span>
                          )}
                          {lodging.room1 > 0 && (
                            <span className={styles.pill}>
                              1인실 {lodging.room1}실
                            </span>
                          )}
                        </span>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                        />
                      </button>
                    ) : (
                      <span className={styles.dash}>—</span>
                    )}
                  </td>
                  <td className={styles.colMeal}>
                    <MealCell meal={meal} />
                  </td>
                </tr>
                {lodging && isOpen && (
                  <tr>
                    <td colSpan={4} className={styles.expandCell}>
                      <div id={panelId} className={styles.rooms}>
                        <div className={styles.roomsTitle}>
                          배정 객실 {lodging.numbers.length}실
                        </div>
                        <RoomFloorView
                          numbers={lodging.numbers}
                          color={r.colorCode || "#EC008C"}
                          organization={r.organization}
                        />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
          <tfoot>
            <tr>
              <th scope="row" className={styles.colDate}>
                합계
              </th>
              <td>{classroomDays > 0 ? `${classroomDays}일` : "—"}</td>
              <td>{nights > 0 ? `${nights}박` : "—"}</td>
              <td className={styles.colMeal}>
                {mealTotal > 0 ? `${mealTotal}식` : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {(merged || lodgingRunCount > 0) && (
        <p className={styles.note}>
          {merged && "내용이 같은 연속된 날짜는 한 줄로 묶었어요. "}
          {lodgingRunCount > 0 && "숙박 줄을 누르면 객실 배치도가 펼쳐집니다."}
        </p>
      )}
    </>
  );
}

// ── 공통 조각 ────────────────────────────────────────────

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title}
        {aside && <span className={styles.sectionAside}>{aside}</span>}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className={styles.row}>
      <span className={styles.key}>{label}</span>
      <span className={styles.val}>{children}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  warn?: boolean;
}) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={`${styles.statValue} ${warn ? styles.statWarn : ""}`}>
        {value}
      </strong>
      <span className={styles.statSub}>{sub}</span>
    </div>
  );
}

interface Contact {
  name: string;
  role: string;
  phones: (string | undefined)[];
  email?: string;
}

function ContactCard({ c }: { c: Contact }) {
  const phones = c.phones.filter(Boolean);
  return (
    <div className={styles.contact}>
      <div className={styles.contactHead}>
        <span className={styles.avatar} aria-hidden="true">
          {(c.name || "-").charAt(0)}
        </span>
        <div className={styles.contactName}>
          <strong>{c.name || "-"}</strong>
          <span>{c.role}</span>
        </div>
      </div>
      {phones.map((p) => (
        <div key={p} className={styles.contactLine}>
          <Phone size={13} aria-hidden="true" />
          {p}
        </div>
      ))}
      {c.email && (
        <div className={styles.contactLine}>
          <Mail size={13} aria-hidden="true" />
          {c.email}
        </div>
      )}
    </div>
  );
}

// 읽기 전용 예약 정보 — 사내 직원용이라 정산·사업자 정보까지 모두 보여준다
export default function ReservationDetailModal({
  reservation: r,
  onClose,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nights = Math.max(diffDays(r.startDate, r.endDate), 0);
  const period = nights === 0 ? "당일" : `${nights}박 ${nights + 1}일`;

  const roomsPerDay = new Map<string, number>();
  for (const room of r.rooms ?? []) {
    const d = String(room.reservedDate);
    roomsPerDay.set(d, (roomsPerDay.get(d) ?? 0) + 1);
  }
  const maxRooms = Math.max(0, ...roomsPerDay.values());

  const meals = r.meals ?? [];
  const sum = (pick: (m: MealReservation) => number) =>
    meals.reduce((s, m) => s + pick(m), 0);
  const breakfast = sum((m) => m.breakfast);
  const lunch = sum((m) => m.lunch);
  const dinner = sum((m) => m.dinner);
  const mealTotal = breakfast + lunch + dinner;

  const contacts: Contact[] = [
    {
      name: r.customer,
      role: "신청인",
      phones: [r.customerPhone, r.customerPhone2],
      email: r.customerEmail,
    },
    {
      name: r.siteManager ?? "",
      role: "현장 담당자",
      phones: [r.siteManagerPhone, r.siteManagerPhone2],
      email: r.siteManagerEmail,
    },
    {
      name: r.billingManager ?? "",
      role: "정산 담당자",
      phones: [r.billingManagerPhone],
      email: r.billingManagerEmail,
    },
  ].filter((c) => c.name || c.phones.some(Boolean) || c.email);

  const statusColor = STATUS_COLOR[r.status] ?? "var(--d-muted)";
  const hasUsage =
    (r.classrooms?.length ?? 0) + (r.rooms?.length ?? 0) + meals.length > 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <div className={styles.headLeft}>
            <div className={styles.titleRow}>
              <h2 id="reservation-detail-title" className={styles.title}>
                {r.organization}
              </h2>
              <span
                className={styles.status}
                style={{
                  color: statusColor,
                  background: `color-mix(in srgb, ${statusColor} 14%, transparent)`,
                }}
              >
                {r.status}
              </span>
            </div>
            {r.purpose && <p className={styles.purpose}>{r.purpose}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className={styles.iconBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.stats}>
            <Stat
              label="이용 기간"
              value={period}
              sub={`${slashDate(r.startDate)} ~ ${slashDate(r.endDate)}`}
            />
            <Stat
              label="인원"
              value={r.people > 0 ? `${r.people}명` : "미입력"}
              sub={r.people > 0 ? "등록 인원" : "0명으로 등록됨"}
              warn={r.people <= 0}
            />
            <Stat
              label="최대 객실"
              value={maxRooms > 0 ? `${maxRooms}실` : "-"}
              sub={maxRooms > 0 ? "하루 기준" : "숙박 없음"}
            />
            <Stat
              label="식사"
              value={mealTotal > 0 ? `${mealTotal}식` : "-"}
              sub={
                mealTotal > 0
                  ? `조 ${breakfast} · 중 ${lunch} · 석 ${dinner}`
                  : "식사 없음"
              }
            />
          </div>

          <Section title="기본 정보">
            <Row label="예약번호">{r.reservationCode}</Row>
            <Row label="교육명">{r.purpose}</Row>
            <Row label="기간">
              {r.startDate === r.endDate
                ? r.startDate
                : `${r.startDate} ~ ${r.endDate}`}
            </Row>
            <Row label="등록일">{r.createdAt?.slice(0, 10)}</Row>
            <Row label="정산 방법">{r.paymentMethod}</Row>
            <Row label="주소">
              {[r.companyZipCode && `(${r.companyZipCode})`, r.companyAddress]
                .filter(Boolean)
                .join(" ")}
            </Row>
            <Row label="사업자번호">{r.businessNumber}</Row>
            <Row label="대표이사">{r.ceoName}</Row>
          </Section>

          {contacts.length > 0 && (
            <Section title="담당자">
              <div className={styles.contacts}>
                {contacts.map((c) => (
                  <ContactCard key={c.role} c={c} />
                ))}
              </div>
            </Section>
          )}

          {hasUsage && (
            <Section
              title="일자별 이용 내역"
              aside={`${slashDate(r.startDate)} ~ ${slashDate(r.endDate)} · ${nights + 1}일`}
            >
              <UsageTable r={r} />
            </Section>
          )}

          {r.memo && (
            <Section title="메모">
              <p className={styles.memo}>{r.memo}</p>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
