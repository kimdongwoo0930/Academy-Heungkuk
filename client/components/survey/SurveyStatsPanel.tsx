'use client';

import { SurveyResult } from '@/types/survey';
import { averageOf, formatAvg, LOW_SCORE, SCORE_ITEMS, SCORE_LABELS, SCORE_ORDER } from './surveyView';
import styles from './SurveyStatsPanel.module.css';

interface Props {
  surveys: SurveyResult[];
}

export default function SurveyStatsPanel({ surveys }: Props) {
  // 전체 평균 = 이용안함(0)을 제외한 모든 점수의 평균
  const overall = averageOf(surveys.flatMap((s) => SCORE_ITEMS.map((i) => s[i.key])));

  const rows = SCORE_ITEMS.map((item) => {
    const scores = surveys.map((s) => s[item.key]);
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    scores.forEach((v) => {
      if (v >= 1 && v <= 5) counts[v]++;
    });
    return { ...item, counts, avg: averageOf(scores) };
  });

  return (
    <section className={styles.panel} aria-label="설문 통계">
      <div className={styles.summary}>
        <div className={styles.summaryLabel}>전체 평균</div>
        <div className={styles.summaryValue}>
          {formatAvg(overall)}
          <span className={styles.summaryMax}> / 5</span>
        </div>
        <div className={styles.summaryCount}>응답 {surveys.length}건</div>
      </div>

      <div className={styles.detail}>
        <ul className={styles.legend} aria-label="점수 범례">
          {SCORE_ORDER.map((score) => (
            <li key={score} className={styles.legendItem} data-score={score}>
              <span className={styles.swatch} aria-hidden="true" />
              {SCORE_LABELS[score]}
            </li>
          ))}
        </ul>

        {rows.map((row) => (
          <div key={row.key} className={styles.row}>
            <div className={styles.rowLabel}>{row.label}</div>
            <div
              className={`${styles.rowAvg} ${row.avg !== null && row.avg < LOW_SCORE ? styles.low : ''}`}
            >
              {formatAvg(row.avg)}
            </div>
            <div
              className={styles.bar}
              role="img"
              aria-label={`${row.label} ${SCORE_ORDER.map((s) => `${SCORE_LABELS[s]} ${row.counts[s]}건`).join(', ')}`}
            >
              {SCORE_ORDER.filter((s) => row.counts[s] > 0).map((s) => (
                <span key={s} className={styles.seg} data-score={s} style={{ flex: `${row.counts[s]} 1 0` }}>
                  {row.counts[s]}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
