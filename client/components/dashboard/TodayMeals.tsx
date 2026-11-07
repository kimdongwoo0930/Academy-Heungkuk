import { TodayMealSummary } from '@/lib/utils/dashboard';
import { UtensilsCrossed } from 'lucide-react';
import styles from './TodayStat.module.css';

interface Props {
  meals: TodayMealSummary;
}

export default function TodayMeals({ meals }: Props) {
  const cells = [
    { label: '조식', value: meals.breakfast },
    { label: '중식', value: meals.lunch },
    { label: '석식', value: meals.dinner },
  ];

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <UtensilsCrossed size={18} aria-hidden="true" />
          오늘 식사
        </h2>
        <span className={styles.sub}>인원 기준</span>
      </div>
      <div className={styles.cells}>
        {cells.map((c) => (
          <div key={c.label} className={styles.cell}>
            <div className={styles.cellLabel}>{c.label}</div>
            <div className={styles.cellValue}>
              {c.value}
              <span className={styles.cellUnit}>명</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
