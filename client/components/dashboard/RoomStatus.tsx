'use client';

import { CLASSROOM_LIST } from '@/lib/constants/classrooms';
import { TodayClassroomItem } from '@/types/dashboard';
import styles from './RoomStatus.module.css';

interface Props {
  todayClassrooms: TodayClassroomItem[];
  disabledClassrooms?: string[];
  onItemClick?: (reservationId: number) => void;
}

const TYPE_ORDER = ['대강의실', '중강의실', '소강의실', '분임실', '다목적실'];

const typeOf = (name: string) => name.split(' ')[0];

const SORTED_ROOMS = [...CLASSROOM_LIST].sort(
  (a, b) => TYPE_ORDER.indexOf(typeOf(a.name)) - TYPE_ORDER.indexOf(typeOf(b.name)),
);

const STATE_LABEL = { available: '사용 가능', inUse: '사용 중', disabled: '사용불가' } as const;

export default function RoomStatus({ todayClassrooms, disabledClassrooms = [], onItemClick }: Props) {
  const occupiedMap = new Map(todayClassrooms.map((c) => [c.classroom, { org: c.organization, id: c.reservationId }]));
  const disabledSet = new Set(disabledClassrooms);
  const inUseCount = SORTED_ROOMS.filter((r) => occupiedMap.has(r.code) && !disabledSet.has(r.code)).length;

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>오늘 강의실 현황</h2>
        <span className={styles.sub}>
          사용 중 <strong>{inUseCount}</strong> / 전체 {SORTED_ROOMS.length}
        </span>
      </div>
      <div className={styles.grid}>
        {SORTED_ROOMS.map((room) => {
          const occupied = occupiedMap.get(room.code);
          const state = disabledSet.has(room.code) ? 'disabled' : occupied ? 'inUse' : 'available';
          const clickable = state === 'inUse' && !!onItemClick;
          const body = (
            <>
              <div className={styles.name}>{room.name}</div>
              <div className={styles.cap}>{room.capacity}인</div>
              <div className={styles.status}>
                <span className={styles.dot} aria-hidden="true" />
                {STATE_LABEL[state]}
              </div>
              {state === 'inUse' && occupied && (
                <div className={styles.org} title={occupied.org}>
                  {occupied.org}
                </div>
              )}
            </>
          );

          return clickable ? (
            <button
              key={room.code}
              type="button"
              className={`${styles.item} ${styles[state]} ${styles.clickable}`}
              onClick={() => onItemClick!(occupied!.id)}
            >
              {body}
            </button>
          ) : (
            <div key={room.code} className={`${styles.item} ${styles[state]}`}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
