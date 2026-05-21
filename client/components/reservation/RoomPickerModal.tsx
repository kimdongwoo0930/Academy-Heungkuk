"use client";

import {
  CellDef,
  FLOOR_GRID_COLS,
  FLOOR_GRID_ROWS,
  FLOOR_LAYOUT_1F,
  FLOOR_LAYOUT_2F,
  ROOM_INFO,
  RoomType,
} from "@/lib/constants/rooms";
import { printRoomViewForDate } from "@/lib/utils/printRoomTable";
import { useRef, useState } from "react";
import styles from "./RoomPickerModal.module.css";

interface Props {
  date: string;
  selected: string[];
  occupiedRooms: string[];
  disabledRooms?: string[];
  onConfirm: (rooms: string[]) => void;
  onClose: () => void;
  viewOnly?: boolean;
  roomColors?: Record<string, string>;
  orgLegend?: { color: string; organization: string }[];
}

const TYPE_COLOR: Record<RoomType, string> = {
  "1인실": "#EC008C",
  "2인실": "#0087D4",
  "4인실": "#F5A623",
};

const TYPE_PASTEL: Record<RoomType, string> = {
  "1인실": "#fce4f3",
  "2인실": "#daeeff",
  "4인실": "#fef3dc",
};

const FLOOR_LAYOUTS: Record<string, CellDef[]> = {
  "1": FLOOR_LAYOUT_1F,
  "2": FLOOR_LAYOUT_2F,
};

export default function RoomPickerModal({
  date,
  selected,
  occupiedRooms,
  disabledRooms = [],
  onConfirm,
  onClose,
  viewOnly = false,
  roomColors = {},
  orgLegend = [],
}: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const [activeFloor, setActiveFloor] = useState<"1" | "2">("1");
  const [pos, setPos] = useState({ dx: 0, dy: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    dx: number;
    dy: number;
  } | null>(null);

  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      dx: pos.dx,
      dy: pos.dy,
    };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({
        dx: dragRef.current.dx + ev.clientX - dragRef.current.startX,
        dy: dragRef.current.dy + ev.clientY - dragRef.current.startY,
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const t = e.touches[0];
    dragRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      dx: pos.dx,
      dy: pos.dy,
    };
    const onMove = (ev: TouchEvent) => {
      if (!dragRef.current) return;
      const touch = ev.touches[0];
      setPos({
        dx: dragRef.current.dx + touch.clientX - dragRef.current.startX,
        dy: dragRef.current.dy + touch.clientY - dragRef.current.startY,
      });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onUp);
  };

  const toggle = (num: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const countByType = (type: RoomType) =>
    [...picked].filter((n) => ROOM_INFO[n]?.type === type).length;

  const layout = FLOOR_LAYOUTS[activeFloor];

  const renderFloorGrid = () => (
    <div
      className={styles.floorGrid}
      style={{
        gridTemplateColumns: `repeat(${FLOOR_GRID_COLS}, 36px)`,
        gridTemplateRows: `repeat(${FLOOR_GRID_ROWS}, 18px)`,
      }}
    >
      {layout.map((cell, idx) => {
        const gridRow = `${cell.row} / span 2`;
        const gridColumn = cell.colSpan
          ? `${cell.col} / span ${cell.colSpan}`
          : `${cell.col}`;

        if (cell.isLabel) {
          return (
            <div
              key={`${cell.id}-${idx}`}
              className={styles.floorLabel}
              style={{ gridRow, gridColumn }}
            >
              {cell.id}
            </div>
          );
        }

        const info = ROOM_INFO[cell.id];
        const isPicked = picked.has(cell.id);
        const isOccupied = occupiedRooms.includes(cell.id);
        const isAdminDisabled = disabledRooms.includes(cell.id);
        const isBlocked = isOccupied || isAdminDisabled;
        const viewColor = viewOnly ? roomColors[cell.id] : undefined;
        const color = viewColor ?? TYPE_COLOR[info.type];
        const pastel = TYPE_PASTEL[info.type];

        const cellClass = [
          styles.roomCell,
          viewOnly ? styles.roomViewOnly : "",
          viewOnly && viewColor ? styles.roomPicked : "",
          !viewOnly && isPicked ? styles.roomPicked : "",
          !viewOnly && isOccupied ? styles.roomOccupied : "",
          !viewOnly && isAdminDisabled && !isOccupied ? styles.roomAdminDisabled : "",
        ]
          .filter(Boolean)
          .join(" ");

        const capLabel = isOccupied ? "사용중" : isAdminDisabled ? "사용불가" : `${info.cap}인`;
        const titleLabel = isOccupied
          ? `${cell.id}호 — 사용중`
          : isAdminDisabled
            ? `${cell.id}호 — 사용불가`
            : `${cell.id}호 (${info.type})`;

        return (
          <button
            key={cell.id}
            className={cellClass}
            style={
              {
                gridRow,
                gridColumn,
                "--c": color,
                "--bg": pastel,
              } as React.CSSProperties
            }
            onClick={viewOnly ? undefined : () => !isBlocked && toggle(cell.id)}
            disabled={!viewOnly && isBlocked}
            title={viewOnly ? (viewColor ? `${cell.id}호 — 예약됨` : `${cell.id}호 (${info.type})`) : titleLabel}
          >
            <span className={styles.cellNum}>{cell.id}호</span>
            <span className={styles.cellCap}>
              {!viewOnly && isBlocked ? capLabel : `${info.cap}인`}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modal}
        style={{ transform: `translate(${pos.dx}px, ${pos.dy}px)` }}
      >
        <div
          className={styles.header}
          onMouseDown={handleDragStart}
          onTouchStart={handleTouchStart}
        >
          <div>
            <h3 className={styles.title}>
              {viewOnly ? "호실 현황" : "호실 선택"}
            </h3>
            <p className={styles.subtitle}>
              {viewOnly
                ? (() => {
                    const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
                    const d = new Date(date);
                    const d2 = new Date(date);
                    d2.setDate(d2.getDate() + 1);
                    const next = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
                    return `${date} (${DAYS[d.getDay()]}) ~ ${next} (${DAYS[d2.getDay()]})`;
                  })()
                : date}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 층 탭 */}
        <div className={styles.floorTabs}>
          {(["1", "2"] as const).map((floor) => (
            <button
              key={floor}
              className={`${styles.floorTab} ${activeFloor === floor ? styles.floorTabActive : ""}`}
              onClick={() => setActiveFloor(floor)}
            >
              {floor}층
            </button>
          ))}
        </div>

        {/* 범례 */}
        <div className={styles.legend}>
          {viewOnly ? (
            orgLegend.length > 0 ? (
              orgLegend.map(({ color, organization }) => (
                <div key={color} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{ background: color }}
                  />
                  <span>{organization}</span>
                </div>
              ))
            ) : (
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ background: "#ccc" }}
                />
                <span>예약 없음</span>
              </div>
            )
          ) : (
            <>
              {(Object.entries(TYPE_COLOR) as [RoomType, string][]).map(
                ([type, color]) => (
                  <div key={type} className={styles.legendItem}>
                    <span
                      className={styles.legendDot}
                      style={{ background: color }}
                    />
                    <span>
                      {type}
                      {countByType(type) > 0 ? ` (${countByType(type)}개)` : ""}
                    </span>
                  </div>
                ),
              )}
              <div className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ background: "#ccc" }}
                />
                <span>사용중</span>
              </div>
            </>
          )}
        </div>

        {/* 도면 */}
        <div className={styles.floorWrap}>{renderFloorGrid()}</div>

        {viewOnly ? (
          <div className={styles.footer}>
            <span className={styles.total}>
              사용중 {occupiedRooms.length}개
            </span>
            <div className={styles.footerBtns}>
              <button
                className={styles.cancelBtn}
                onClick={() =>
                  printRoomViewForDate(date, occupiedRooms, roomColors, orgLegend)
                }
              >
                인쇄
              </button>
              <button className={styles.cancelBtn} onClick={onClose}>
                닫기
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.footer}>
            <span className={styles.total}>총 {picked.size}개 선택</span>
            <div className={styles.footerBtns}>
              <button className={styles.cancelBtn} onClick={onClose}>
                취소
              </button>
              <button
                className={styles.confirmBtn}
                onClick={() => onConfirm([...picked])}
              >
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
