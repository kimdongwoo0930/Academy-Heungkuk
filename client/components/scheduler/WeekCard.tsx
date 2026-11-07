"use client";

import { toChipColor } from "@/lib/utils/dashboard";
import { Star } from "lucide-react";
import { CSSProperties, MouseEvent } from "react";
import styles from "./WeekCard.module.css";

export interface WeekDay {
  dateStr: string;
  month: number; // 1-12
  day: number;
  dow: number; // 0=일
  isCurrent: boolean; // 보고 있는 달 여부
  isToday: boolean;
  kind: "sat" | "sun" | null; // 토요일 / 일요일·공휴일
}

export type CellVariant = "normal" | "pending" | "special";

export interface WeekCell {
  value: number;
  variant?: CellVariant;
}

export interface WeekRow {
  key: string | number;
  org: string;
  colorCode: string;
  /** [날짜 인덱스][하위 칸 인덱스] */
  cells: WeekCell[][];
  total: number;
  onSelect?: () => void;
  onCellHover?: (e: MouseEvent, dayIndex: number) => void;
  onCellLeave?: () => void;
}

interface Props {
  title: string;
  days: WeekDay[];
  subLabels: [string, string, string];
  rows: WeekRow[];
  /** [날짜 인덱스][하위 칸 인덱스] — "일 합계" 줄 */
  dayTotals: number[][];
  grandTotal: number;
  totalHeader: string;
  emptyText: string;
  onDayClick?: (day: WeekDay) => void;
  onDayDoubleClick?: (day: WeekDay) => void;
}

const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 사람이 읽는 합계는 0 을 "—" 로 보여준다
const dash = (n: number) => (n > 0 ? n : "—");

export default function WeekCard({
  title,
  days,
  subLabels,
  rows,
  dayTotals,
  grandTotal,
  totalHeader,
  emptyText,
  onDayClick,
  onDayDoubleClick,
}: Props) {
  const gridVars = { "--n": days.length * 3 } as CSSProperties;
  const empty = rows.length === 0;

  const dayCls = (d: WeekDay) =>
    [d.isToday ? styles.today : d.kind ? styles.weekend : "", d.isCurrent ? "" : styles.outside].join(" ");

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {empty && <span className={styles.tag}>예약 없음</span>}
      </div>

      {empty ? (
        <div className={styles.empty}>{emptyText}</div>
      ) : (
        <div className={styles.scroll}>
          <div className={styles.table} style={gridVars}>
            {/* 헤더: 날짜 / 하위 칸 */}
            <div className={`${styles.row} ${styles.headRow}`} style={gridVars}>
              <div className={styles.orgHead}>단체</div>
              {days.map((d, i) => {
                const dowCls = d.kind === "sat" ? styles.sat : d.kind === "sun" ? styles.sun : "";
                const label = `${d.month}/${d.day} ${WEEK_DAYS[d.dow]}`;
                return (
                  <div
                    key={d.dateStr}
                    className={`${styles.dayHead} ${dayCls(d)} ${dowCls}${d.isToday ? ` ${styles.todayHead}` : ""}`}
                    style={{ gridColumn: `${i * 3 + 2} / span 3` }}
                  >
                    {onDayClick && d.isCurrent ? (
                      <button
                        type="button"
                        className={styles.dayBtn}
                        onClick={() => onDayClick(d)}
                        onDoubleClick={() => onDayDoubleClick?.(d)}
                        aria-label={`${d.month}월 ${d.day}일 객실 배정 보기`}
                      >
                        {label}
                      </button>
                    ) : (
                      <span>{label}</span>
                    )}
                    <div className={styles.subHeads}>
                      {subLabels.map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className={styles.totalHead}>{totalHeader}</div>
            </div>

            {/* 단체별 줄 */}
            {rows.map((row) => {
              const color = toChipColor(row.colorCode);
              const rowStyle = {
                ...gridVars,
                "--c": color.rgb,
                "--fg-light": color.fgLight,
                "--fg-dark": color.fgDark,
              } as CSSProperties;
              return (
                <div key={row.key} className={`${styles.row} ${styles.dataRow}`} style={rowStyle}>
                  <div className={styles.orgCell}>
                    <span className={styles.dot} style={{ backgroundColor: row.colorCode }} aria-hidden="true" />
                    {row.onSelect ? (
                      <button type="button" className={styles.orgBtn} onClick={row.onSelect} title={row.org}>
                        {row.org}
                      </button>
                    ) : (
                      <span className={styles.orgBtn} title={row.org}>
                        {row.org}
                      </span>
                    )}
                  </div>
                  {days.map((d, i) => (
                    <div
                      key={d.dateStr}
                      className={`${styles.dayCells} ${dayCls(d)}`}
                      style={{ gridColumn: `${i * 3 + 2} / span 3` }}
                      onMouseEnter={(e) => row.onCellHover?.(e, i)}
                      onMouseMove={(e) => row.onCellHover?.(e, i)}
                      onMouseLeave={row.onCellLeave}
                    >
                      {row.cells[i].map((c, k) => (
                        <span key={k} className={styles.slot}>
                          {c.value > 0 && (
                            <span
                              className={`${styles.chip}${c.variant === "pending" ? ` ${styles.chipPending}` : ""}${c.variant === "special" ? ` ${styles.chipSpecial}` : ""}`}
                              aria-label={c.variant === "special" ? `특식 ${c.value}` : undefined}
                            >
                              {c.variant === "special" && <Star size={9} fill="currentColor" aria-hidden="true" />}
                              {c.value}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  ))}
                  <div className={styles.rowTotal}>{row.total > 0 ? row.total : ""}</div>
                </div>
              );
            })}

            {/* 일 합계 */}
            <div className={`${styles.row} ${styles.sumRow}`} style={gridVars}>
              <div className={styles.sumLabel}>일 합계</div>
              {days.map((d, i) => (
                <div
                  key={d.dateStr}
                  className={`${styles.dayCells} ${styles.sumCells} ${dayCls(d)}`}
                  style={{ gridColumn: `${i * 3 + 2} / span 3` }}
                >
                  {dayTotals[i].map((v, k) => (
                    <span key={k} className={styles.slot}>
                      {dash(v)}
                    </span>
                  ))}
                </div>
              ))}
              <div className={`${styles.rowTotal} ${styles.grand}`}>{grandTotal}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
