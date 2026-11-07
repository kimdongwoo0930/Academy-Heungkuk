import { Lodging, LodgingGroup, toChipColor } from '@/lib/utils/dashboard';
import { BedDouble } from 'lucide-react';
import styles from './TodayStat.module.css';

interface Props {
  groups: LodgingGroup[];
  lodging: Lodging;
  onSelect?: (reservationId: number) => void;
}

export default function TodayLodging({ groups, lodging, onSelect }: Props) {
  const cells = [
    { label: '4인실', value: lodging.room4 },
    { label: '2인실', value: lodging.room2 },
    { label: '1인실', value: lodging.room1 },
  ];

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <BedDouble size={18} aria-hidden="true" />
          오늘 숙박 현황
        </h2>
        <span className={styles.sub}>객실 수 기준</span>
      </div>
      <div className={styles.groups}>
        {groups.length === 0 && <div className={styles.groupEmpty}>투숙 단체 없음</div>}
        {groups.map((g) => {
          const body = (
            <>
              <span
                className={styles.groupDot}
                style={{ background: `rgb(${toChipColor(g.colorCode).rgb})` }}
                aria-hidden="true"
              />
              <span className={styles.groupName} title={g.org}>
                {g.org}
              </span>
            </>
          );
          return onSelect ? (
            <button
              key={g.id}
              type="button"
              className={`${styles.group} ${styles.groupClickable}`}
              onClick={() => onSelect(g.id)}
              aria-label={`${g.org} 숙박 정보 보기`}
            >
              {body}
            </button>
          ) : (
            <div key={g.id} className={styles.group}>
              {body}
            </div>
          );
        })}
      </div>
      <div className={styles.cells}>
        {cells.map((c) => (
          <div key={c.label} className={styles.cell}>
            <div className={styles.cellLabel}>{c.label}</div>
            <div className={styles.cellValue}>
              {c.value}
              <span className={styles.cellUnit}>실</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
