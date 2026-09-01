'use client';

import { useTheme } from '@/components/theme/ThemeProvider';
import { BsMoonStarsFill, BsSunFill } from 'react-icons/bs';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, mounted, toggleTheme } = useTheme();

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={toggleTheme}
        aria-label={mounted ? (theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환') : '테마 전환'}
        title={mounted ? (theme === 'dark' ? '라이트 모드' : '다크 모드') : '테마 전환'}
        disabled={!mounted}
      >
        {mounted ? (theme === 'dark' ? <BsSunFill /> : <BsMoonStarsFill />) : <span className={styles.placeholder} aria-hidden="true" />}
      </button>
    </div>
  );
}
