'use client';

import { SurveyResult } from '@/types/survey';
import { ChevronDown, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import {
  formatAvg,
  formatResponseTime,
  formatShortRange,
  hasAnyComment,
  isPositiveRevisit,
  LOW_SCORE,
  SCORE_ITEMS,
  SCORE_LABELS,
  surveyAverage,
  withEtc,
} from './surveyView';
import styles from './SurveyTable.module.css';

interface Props {
  surveys: SurveyResult[];
}

function SurveyRow({ data, open, onToggle }: { data: SurveyResult; open: boolean; onToggle: () => void }) {
  const avg = surveyAverage(data);
  const positive = isPositiveRevisit(data.revisit);
  const detailId = `survey-detail-${data.id}`;

  const meta = [
    withEtc(data.location, data.locationEtc),
    withEtc(data.purpose, data.purposeEtc),
    withEtc(data.industry, data.industryEtc),
    withEtc(data.visitRoute, data.visitRouteEtc),
  ];

  return (
    <div className={styles.item}>
      <button
        type="button"
        className={styles.row}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={detailId}
      >
        <span className={styles.org}>
          <span className={styles.orgBar} style={{ backgroundColor: data.colorCode ?? 'var(--d-muted)' }} aria-hidden="true" />
          <span className={styles.orgText}>
            <span className={styles.orgName}>
              <span className={styles.orgNameText}>{data.organization ?? '-'}</span>
              {hasAnyComment(data) && (
                <MessageCircle size={14} className={styles.commentIcon} aria-label="의견 있음" role="img" />
              )}
            </span>
            <span className={styles.orgMeta}>
              {data.reservationId} · {data.customer ?? '-'}
            </span>
          </span>
        </span>

        <span className={styles.date}>{formatShortRange(data.startDate, data.endDate)}</span>

        {SCORE_ITEMS.map((item) => {
          const score = data[item.key];
          return (
            <span key={item.key} className={styles.scoreCol}>
              {score >= 1 && score <= 5 ? (
                <span className={styles.scoreCell} data-score={score} title={`${item.label}: ${SCORE_LABELS[score]}`}>
                  {score}
                </span>
              ) : (
                <span className={`${styles.scoreCell} ${styles.skipped}`} title={`${item.label}: 이용안함`}>
                  –
                  <span className={styles.srOnly}>이용안함</span>
                </span>
              )}
            </span>
          );
        })}

        <span className={`${styles.avg} ${avg !== null && avg < LOW_SCORE ? styles.low : ''}`}>{formatAvg(avg)}</span>

        <span className={styles.revisit}>
          <span className={`${styles.dot} ${positive ? styles.dotOk : styles.dotWarn}`} aria-hidden="true" />
          <span className={`${styles.revisitText} ${positive ? styles.ok : styles.warn}`} title={data.revisit}>
            {data.revisit}
          </span>
        </span>

        <span className={styles.chevronCol}>
          <ChevronDown size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`} aria-hidden="true" />
        </span>
      </button>

      {open && (
        <div id={detailId} className={styles.detail}>
          <p className={styles.metaLine}>
            {['응답 ' + formatResponseTime(data.createdAt), ...meta].join(' · ')}
          </p>

          <div className={styles.cards}>
            {SCORE_ITEMS.map((item) => {
              const score = data[item.key];
              const comment = data[`${item.key}Comment` as const];
              const used = score >= 1 && score <= 5;
              return (
                <div key={item.key} className={styles.card} data-score={used ? score : undefined}>
                  <div className={styles.cardLabel}>{item.label}</div>
                  <div className={styles.cardValue}>
                    <span className={`${styles.square} ${used ? '' : styles.squareSkipped}`} aria-hidden="true" />
                    {SCORE_LABELS[used ? score : 0]}
                  </div>
                  {used && comment && <p className={styles.cardComment}>{comment}</p>}
                </div>
              );
            })}
          </div>

          <div className={styles.revisitBox}>
            <div className={styles.revisitHead}>
              <span className={styles.revisitLabel}>재방문 의향</span>
              <span className={`${styles.badge} ${positive ? styles.badgeOk : styles.badgeWarn}`}>{data.revisit}</span>
            </div>
            {data.revisitComment && <p className={styles.revisitComment}>{data.revisitComment}</p>}
            {data.comment && <p className={styles.revisitComment}>{data.comment}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SurveyTable({ surveys }: Props) {
  // 사용자가 직접 펼치거나 접은 행만 기록하고, 나머지는 첫 행만 펼친 상태가 기본
  const [toggled, setToggled] = useState<Record<number, boolean>>({});

  return (
    <div className={styles.wrap}>
      <div className={styles.table} role="table" aria-label="설문 응답 내역">
        <div className={styles.head} role="row">
          <span>단체</span>
          <span>이용일</span>
          {SCORE_ITEMS.map((i) => (
            <span key={i.key} className={styles.center}>
              {i.label}
            </span>
          ))}
          <span className={styles.center}>평균</span>
          <span>재방문 의향</span>
          <span />
        </div>
        {surveys.map((s, idx) => (
          <SurveyRow
            key={s.id}
            data={s}
            open={toggled[s.id] ?? idx === 0}
            onToggle={() => setToggled((prev) => ({ ...prev, [s.id]: !(prev[s.id] ?? idx === 0) }))}
          />
        ))}
      </div>
    </div>
  );
}
