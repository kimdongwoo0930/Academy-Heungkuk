import { SatisfactionData } from '@/types/dashboard';
import Link from 'next/link';
import styles from './SatisfactionSummary.module.css';

const ITEMS = [
  { key: 'staffService', label: '직원 서비스' },
  { key: 'cleanliness', label: '청결 상태' },
  { key: 'cafeteria', label: '식당' },
  { key: 'pricing', label: '이용 비용' },
  { key: 'facilities', label: '시설' },
] as const;

const NEEDS_IMPROVEMENT = 4.0;

interface Props {
  satisfaction: SatisfactionData;
}

export default function SatisfactionSummary({ satisfaction }: Props) {
  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <h2 className={styles.title}>설문 만족도 요약</h2>
          <span className={styles.sub}>누적 {satisfaction.totalCount}건</span>
        </div>
        <Link href="/survey" className={styles.more}>
          전체 보기 →
        </Link>
      </div>
      <div className={styles.grid}>
        {ITEMS.map((item) => {
          const score = satisfaction[item.key];
          // 이 항목에 응답이 없으면(예: 식당 전원 '이용 안함') 0 으로 내려오므로 점수 없음으로 처리한다
          const hasData = score > 0;
          const low = hasData && score < NEEDS_IMPROVEMENT;
          return (
            <div key={item.key} className={styles.item}>
              <div className={styles.labelRow}>
                <span className={styles.label}>{item.label}</span>
              </div>
              <div className={styles.score}>
                {hasData ? score.toFixed(1) : '-'}
                <span className={styles.max}> / 5.0</span>
              </div>
              <div
                className={styles.track}
                role="meter"
                aria-label={`${item.label} 만족도`}
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={hasData ? score : 0}
              >
                <div
                  className={`${styles.fill} ${low ? styles.fillLow : ''}`}
                  style={{ width: `${hasData ? Math.min(100, (score / 5) * 100) : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
