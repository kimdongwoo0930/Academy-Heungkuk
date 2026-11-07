'use client';

import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import styles from './Header.module.css';

const PAGE_TITLES: Record<string, string> = {
  '/load': '설문 관리',
  '/settings': '설정',
};

interface Props {
  collapsed: boolean;
}

export default function Header({ collapsed }: Props) {
  const pathname = usePathname();
  const title = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] ?? '';

  return (
    <header className={`${styles.header} ${collapsed ? styles.headerCollapsed : ''}`}>
      <span className={styles.title}>{title}</span>
      <div className={styles.actions}>
        <ThemeToggle />
      </div>
    </header>
  );
}
