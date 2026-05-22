import { TodayClassroomItem } from "@/types/dashboard";
import styles from "./TodaySchedule.module.css";

const DOT_COLORS = ["#e8306a", "#2563eb", "#0eab6e", "#f97316", "#7c3aed"];

interface Props {
  todayClassrooms: TodayClassroomItem[];
  onItemClick?: (reservationId: number) => void;
}

interface GroupedItem {
  reservationId: number;
  organization: string;
  classrooms: string[];
  purpose: string;
  people: number;
}

function groupByOrganization(items: TodayClassroomItem[]): GroupedItem[] {
  const map = new Map<string, GroupedItem>();
  for (const item of items) {
    const existing = map.get(item.organization);
    if (existing) {
      existing.classrooms.push(item.classroom);
    } else {
      map.set(item.organization, {
        reservationId: item.reservationId,
        organization: item.organization,
        classrooms: [item.classroom],
        purpose: item.purpose,
        people: item.people,
      });
    }
  }
  return Array.from(map.values());
}

export default function TodaySchedule({ todayClassrooms, onItemClick }: Props) {
  const groups = groupByOrganization(todayClassrooms);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.title}>금일 이용 현황</span>
        <span className={styles.count}>{groups.length}건</span>
      </div>
      <div className={styles.list}>
        {groups.length === 0 && (
          <div className={styles.empty}>
            오늘 예정된 강의실 일정이 없습니다.
          </div>
        )}
        {groups.map((g, i) => (
          <div
            key={i}
            className={`${styles.item} ${onItemClick ? styles.clickable : ""}`}
            onClick={() => onItemClick?.(g.reservationId)}
          >
            <div
              className={styles.dot}
              style={{ background: DOT_COLORS[i % DOT_COLORS.length] }}
            />
            <div className={styles.info}>
              <div className={styles.org}>{g.organization}</div>
              <div className={styles.room}>
                {g.classrooms.join(" · ")}호 · {g.purpose} · {g.people}명
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
