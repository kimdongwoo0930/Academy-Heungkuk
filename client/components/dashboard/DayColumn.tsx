'use client';

import { BookingCard, parseDateStr, WEEKDAYS } from '@/lib/utils/dashboard';
import { useEffect, useId, useRef } from 'react';
import BookingChip from './BookingChip';
import styles from './DayColumn.module.css';
import MoreBookingsPopover from './MoreBookingsPopover';

export const MAX_VISIBLE = 3;

interface Props {
  date: string;
  cards: BookingCard[];
  index: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect?: (reservationId: number) => void;
}

export default function DayColumn({ date, cards, index, open, onToggle, onClose, onSelect }: Props) {
  const d = parseDateStr(date);
  const dow = d.getDay();
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const visible = cards.slice(0, MAX_VISIBLE);
  const hiddenCount = cards.length - visible.length;

  // 열려 있는 동안만 ESC / 바깥 클릭을 감시한다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open, onClose]);

  const weekend = dow === 0 || dow === 6;
  const dowClass = dow === 6 ? styles.sat : dow === 0 ? styles.sun : '';

  return (
    <div ref={rootRef} className={`${styles.col} ${weekend ? styles.weekend : ''} ${index === 0 ? styles.today : ''}`}>
      <div className={styles.head}>
        <div className={styles.dateWrap}>
          <span className={styles.day}>{d.getDate()}</span>
          <span className={`${styles.dow} ${dowClass}`}>
            {WEEKDAYS[dow]}
            {index === 0 && <span className={styles.todayTag}> · 오늘</span>}
          </span>
        </div>
        <span className={styles.count}>{cards.length}건</span>
      </div>

      <div className={styles.body}>
        {visible.map((card) => (
          <BookingChip key={card.key} card={card} onSelect={onSelect} />
        ))}
        {hiddenCount > 0 && (
          <button
            ref={buttonRef}
            type="button"
            className={styles.more}
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={open ? popoverId : undefined}
          >
            +{hiddenCount}건 더 보기
          </button>
        )}
      </div>

      {open && (
        <MoreBookingsPopover
          id={popoverId}
          date={date}
          cards={cards}
          alignRight={index >= 4}
          onClose={onClose}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
