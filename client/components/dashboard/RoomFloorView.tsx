'use client';

import {
  CellDef,
  FLOOR_GRID_COLS,
  FLOOR_GRID_ROWS,
  FLOOR_LAYOUT_1F,
  FLOOR_LAYOUT_2F,
  ROOM_INFO,
} from '@/lib/constants/rooms';
import { CSSProperties, useState } from 'react';
import { TYPE_COLOR, TYPE_PASTEL } from '../reservation/RoomPickerModal';
import cell from '../reservation/RoomPickerModal.module.css';
import styles from './RoomFloorView.module.css';

interface Props {
  /** 이 예약에 배정된 호실 번호 */
  numbers: string[];
  color: string;
  organization: string;
}

const LAYOUTS: Record<1 | 2, CellDef[]> = { 1: FLOOR_LAYOUT_1F, 2: FLOOR_LAYOUT_2F };

// 숙소 현황의 호실 도면(읽기 전용)을 모달 없이 그 자리에서 보여준다
export default function RoomFloorView({ numbers, color, organization }: Props) {
  const picked = new Set(numbers);
  const countOf = (floor: 1 | 2) => numbers.filter((n) => ROOM_INFO[n]?.floor === floor).length;

  // 배정 호실이 있는 층부터 보여준다
  const [floor, setFloor] = useState<1 | 2>(() => (countOf(1) > 0 || countOf(2) === 0 ? 1 : 2));

  return (
    <div className={styles.wrap}>
      <div className={styles.bar}>
        <div className={styles.tabs} role="tablist" aria-label="층 선택">
          {([1, 2] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={floor === f}
              className={`${styles.tab} ${floor === f ? styles.tabActive : ''}`}
              onClick={() => setFloor(f)}
            >
              {f}층
              {countOf(f) > 0 && <span className={styles.tabCount}>{countOf(f)}</span>}
            </button>
          ))}
        </div>
        <span className={styles.legend}>
          <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
          {organization}
        </span>
      </div>

      <div
        className={`${cell.floorGrid} ${styles.grid}`}
        style={{
          gridTemplateColumns: `repeat(${FLOOR_GRID_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${FLOOR_GRID_ROWS}, 18px)`,
        }}
      >
        {LAYOUTS[floor].map((c, idx) => {
          const gridRow = `${c.row} / span 2`;
          const gridColumn = c.colSpan ? `${c.col} / span ${c.colSpan}` : `${c.col}`;

          if (c.isLabel) {
            return (
              <div key={`${c.id}-${idx}`} className={cell.floorLabel} style={{ gridRow, gridColumn }}>
                {c.id}
              </div>
            );
          }

          const info = ROOM_INFO[c.id];
          const isPicked = picked.has(c.id);
          return (
            <div
              key={c.id}
              className={`${cell.roomCell} ${cell.roomViewOnly} ${isPicked ? cell.roomPicked : ''}`}
              style={
                {
                  gridRow,
                  gridColumn,
                  '--c': isPicked ? color : TYPE_COLOR[info.type],
                  '--bg': TYPE_PASTEL[info.type],
                } as CSSProperties
              }
              title={isPicked ? `${c.id}호 — 배정됨` : `${c.id}호 (${info.type})`}
            >
              <span className={cell.cellNum}>{c.id}호</span>
              <span className={cell.cellCap}>{info.cap}인</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
