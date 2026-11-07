"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import styles from "./MonthSwitcher.module.css";

interface Props {
  year: number;
  month: number; // 0-indexed
  onPrev: () => void;
  onNext: () => void;
  onJump: (year: number, month: number) => void;
}

// 일정 현황 전용 월 이동 박스 — 라벨을 누르면 월 선택기가 열리는 기존 동작을 유지한다
export default function MonthSwitcher({ year, month, onPrev, onNext, onJump }: Props) {
  const [picking, setPicking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const value = `${year}-${String(month + 1).padStart(2, "0")}`;

  const handleLabelClick = () => {
    setPicking(true);
    setTimeout(() => inputRef.current?.showPicker?.(), 50);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [y, m] = e.target.value.split("-").map(Number);
    onJump(y, m - 1);
    setPicking(false);
  };

  return (
    <div className={styles.box}>
      <button type="button" className={styles.arrow} onClick={onPrev} aria-label="이전 달">
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {picking ? (
        <input
          ref={inputRef}
          type="month"
          className={styles.monthInput}
          defaultValue={value}
          onChange={handleChange}
          onBlur={() => setPicking(false)}
          aria-label="이동할 월 선택"
          autoFocus
        />
      ) : (
        <button type="button" className={styles.label} onClick={handleLabelClick} title="클릭하여 월 이동">
          {year}년 {month + 1}월
        </button>
      )}
      <button type="button" className={styles.arrow} onClick={onNext} aria-label="다음 달">
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
