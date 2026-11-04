'use client';

import { UpcomingDay } from '@/lib/utils/dashboard';
import { useCallback, useState } from 'react';
import DayColumn from './DayColumn';
import styles from './UpcomingWeek.module.css';

interface Props {
  days: UpcomingDay[];
  onSelectBooking?: (reservationId: number) => void;
}

export default function UpcomingWeek({ days, onSelectBooking }: Props) {
  // 한 번에 하나의 팝오버만 연다
  const [openDate, setOpenDate] = useState<string | null>(null);
  const close = useCallback(() => setOpenDate(null), []);
  const select = useCallback(
    (id: number) => {
      setOpenDate(null);
      onSelectBooking?.(id);
    },
    [onSelectBooking],
  );

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <h2 className={styles.title}>다가오는 일정</h2>
          <span className={styles.sub}>오늘부터 7일</span>
        </div>
        <span className={styles.hint}>숙박 숫자는 4인실 / 2인실 / 1인실 순</span>
      </div>
      <div className={styles.grid}>
        {days.map((day, i) => (
          <DayColumn
            key={day.date}
            date={day.date}
            cards={day.cards}
            index={i}
            open={openDate === day.date}
            onToggle={() => setOpenDate((cur) => (cur === day.date ? null : day.date))}
            onClose={close}
            onSelect={onSelectBooking ? select : undefined}
          />
        ))}
      </div>
    </section>
  );
}
