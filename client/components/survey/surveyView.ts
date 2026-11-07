import { SurveyResult } from '@/types/survey';

export type ScoreKey = 'staffService' | 'cleanliness' | 'facilities' | 'cafeteria' | 'pricing';

export const SCORE_ITEMS: { key: ScoreKey; label: string }[] = [
  { key: 'staffService', label: '직원서비스' },
  { key: 'cleanliness', label: '청결' },
  { key: 'facilities', label: '시설' },
  { key: 'cafeteria', label: '식당' },
  { key: 'pricing', label: '비용' },
];

// 1=매우불만족 ~ 5=매우만족 (높을수록 좋음), 0=이용안함
export const SCORE_LABELS: Record<number, string> = {
  0: '이용안함',
  1: '매우불만족',
  2: '불만족',
  3: '보통',
  4: '만족',
  5: '매우만족',
};

// 범례·누적 막대 순서: 매우만족 → 매우불만족
export const SCORE_ORDER = [5, 4, 3, 2, 1] as const;

export const LOW_SCORE = 4.0;

/** 이용안함(0)을 제외한 평균. 응답이 없으면 null */
export function averageOf(scores: number[]): number | null {
  const valid = scores.filter((s) => s >= 1 && s <= 5);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export function surveyAverage(s: SurveyResult): number | null {
  return averageOf(SCORE_ITEMS.map((i) => s[i.key]));
}

export function formatAvg(avg: number | null): string {
  return avg === null ? '-' : avg.toFixed(1);
}

/** "10/22 ~ 10/23" — 하루짜리는 날짜 하나만 */
export function formatShortRange(start: string | null, end: string | null): string {
  if (!start) return '-';
  const short = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  if (!end || end === start) return short(start);
  return `${short(start)} ~ ${short(end)}`;
}

/** "2026-11-03 오전 10:12" */
export function formatResponseTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = d.getHours();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${ampm} ${pad(h12)}:${pad(d.getMinutes())}`;
}

/** 선택값 + 기타 입력을 한 문자열로 */
export function withEtc(value: string, etc: string | null): string {
  return etc ? `${value} (${etc})` : value;
}

/** 재방문 의향 색 규칙: 긍정 = 초록, 그 외 = 노랑 */
export function isPositiveRevisit(revisit: string): boolean {
  return revisit === '매우 그렇다' || revisit === '그렇다';
}

export function hasAnyComment(s: SurveyResult): boolean {
  return Boolean(
    s.staffServiceComment ||
      s.cleanlinessComment ||
      s.facilitiesComment ||
      s.cafeteriaComment ||
      s.pricingComment ||
      s.revisitComment ||
      s.comment,
  );
}
