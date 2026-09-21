"use client";

import { BsArrowClockwise } from "react-icons/bs";
import styles from "./RefreshStatus.module.css";

interface Props {
  /** 데이터가 마지막으로 갱신된 시각 */
  lastUpdated: Date;
  /** 새로고침 버튼 클릭 시 실행 */
  onRefresh: () => void;
  className?: string;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** "오후 3:24 기준" + 수동 새로고침 버튼 — 1분마다 자동 갱신되는 목록/표 상단에 붙여서 쓴다 */
export default function RefreshStatus({ lastUpdated, onRefresh, className }: Props) {
  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <span className={styles.time}>{formatTime(lastUpdated)} 기준</span>
      <button
        type="button"
        className={styles.btn}
        onClick={onRefresh}
        title="새로고침"
      >
        <BsArrowClockwise />
      </button>
    </div>
  );
}
