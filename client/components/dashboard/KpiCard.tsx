import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';
import styles from './KpiCard.module.css';

type Tone = 'accent' | 'green' | 'warn';

interface Props {
  label: string;
  value: string | number;
  unit?: ReactNode;
  sub: ReactNode;
  Icon: LucideIcon;
  tone: Tone;
}

export default function KpiCard({ label, value, unit, sub, Icon, tone }: Props) {
  return (
    <div className={styles.card}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        <div className={`${styles.iconBox} ${styles[tone]}`} aria-hidden="true">
          <Icon size={18} strokeWidth={2} />
        </div>
      </div>
      <div className={styles.value}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      <div className={styles.sub}>{sub}</div>
    </div>
  );
}
