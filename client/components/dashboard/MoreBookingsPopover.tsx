import { BookingCard, formatMonthDay, parseDateStr, WEEKDAYS } from '@/lib/utils/dashboard';
import { X } from 'lucide-react';
import BookingChip from './BookingChip';
import styles from './MoreBookingsPopover.module.css';

interface Props {
  id: string;
  date: string;
  cards: BookingCard[];
  alignRight: boolean;
  onClose: () => void;
  onSelect?: (reservationId: number) => void;
}

export default function MoreBookingsPopover({ id, date, cards, alignRight, onClose, onSelect }: Props) {
  const weekday = WEEKDAYS[parseDateStr(date).getDay()];

  return (
    <div
      id={id}
      role="dialog"
      aria-label={`${formatMonthDay(date)} 예약 전체`}
      className={`${styles.popover} ${alignRight ? styles.right : styles.left}`}
    >
      <div className={styles.head}>
        <span className={styles.title}>
          {formatMonthDay(date)} ({weekday}) · 예약 {cards.length}건
        </span>
        <button type="button" className={styles.close} onClick={onClose} aria-label="팝오버 닫기">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.list}>
        {cards.map((card) => (
          <BookingChip key={card.key} card={card} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
