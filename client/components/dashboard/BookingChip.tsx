import { BookingCard, formatMonthDay, toChipColor } from '@/lib/utils/dashboard';
import { CSSProperties } from 'react';
import styles from './BookingChip.module.css';

interface Props {
  card: BookingCard;
  onSelect?: (reservationId: number) => void;
}

export default function BookingChip({ card, onSelect }: Props) {
  const color = toChipColor(card.colorCode);
  const style = {
    '--c': color.rgb,
    '--fg-light': color.fgLight,
    '--fg-dark': color.fgDark,
  } as CSSProperties;

  // 연박: 첫날은 종료일, 이어지는 날은 N일차
  const tag = card.dayNo > 1 ? `${card.dayNo}일차` : card.endDate ? `~${formatMonthDay(card.endDate)}` : null;
  const l = card.lodging;

  const body = (
    <>
      <div className={styles.row}>
        <span className={styles.org} title={card.org}>
          {card.org}
        </span>
        {tag && <span className={styles.tag}>{tag}</span>}
      </div>
      <div className={styles.place} title={card.place}>
        {card.place}
      </div>
      {l && (
        <div className={styles.pill}>
          숙박 {l.room4}/{l.room2}/{l.room1}
        </div>
      )}
    </>
  );

  return onSelect ? (
    <button
      type="button"
      className={`${styles.chip} ${styles.clickable}`}
      style={style}
      onClick={() => onSelect(card.reservationId)}
      aria-label={`${card.org} 예약 상세 보기`}
    >
      {body}
    </button>
  ) : (
    <div className={styles.chip} style={style}>
      {body}
    </div>
  );
}
