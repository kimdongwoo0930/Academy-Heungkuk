export type RoomType = '1인실' | '2인실' | '4인실';

export const ROOM_TYPES: RoomType[] = ['4인실', '2인실', '1인실'];

export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  '4인실': '4인 침대',
  '2인실': '2인 침대',
  '1인실': '1인 침대',
};

export interface RoomInfo {
  number: string;
  type: RoomType;
  cap: number;
  floor: 1 | 2;
}

// 호실 정보 (타입·정원·층)
export const ROOM_INFO: Record<string, RoomInfo> = {
  // ── 1층 ──
  '101': { number: '101', type: '4인실', cap: 4, floor: 1 },
  '102': { number: '102', type: '4인실', cap: 4, floor: 1 },
  '103': { number: '103', type: '4인실', cap: 4, floor: 1 },
  '104': { number: '104', type: '4인실', cap: 4, floor: 1 },
  '105': { number: '105', type: '4인실', cap: 4, floor: 1 },
  '106': { number: '106', type: '4인실', cap: 4, floor: 1 },
  '107': { number: '107', type: '4인실', cap: 4, floor: 1 },
  '108': { number: '108', type: '4인실', cap: 4, floor: 1 },
  '109': { number: '109', type: '1인실', cap: 1, floor: 1 },
  '110': { number: '110', type: '2인실', cap: 2, floor: 1 },
  '111': { number: '111', type: '2인실', cap: 2, floor: 1 },
  '112': { number: '112', type: '4인실', cap: 4, floor: 1 },
  '113': { number: '113', type: '4인실', cap: 4, floor: 1 },
  '114': { number: '114', type: '4인실', cap: 4, floor: 1 },
  '115': { number: '115', type: '4인실', cap: 4, floor: 1 },
  '116': { number: '116', type: '4인실', cap: 4, floor: 1 },
  '117': { number: '117', type: '4인실', cap: 4, floor: 1 },
  '118': { number: '118', type: '4인실', cap: 4, floor: 1 },
  '119': { number: '119', type: '4인실', cap: 4, floor: 1 },
  '120': { number: '120', type: '4인실', cap: 4, floor: 1 },
  '121': { number: '121', type: '4인실', cap: 4, floor: 1 },
  '122': { number: '122', type: '4인실', cap: 4, floor: 1 },
  '123': { number: '123', type: '4인실', cap: 4, floor: 1 },
  '124': { number: '124', type: '4인실', cap: 4, floor: 1 },
  '125': { number: '125', type: '4인실', cap: 4, floor: 1 },
  '126': { number: '126', type: '1인실', cap: 1, floor: 1 },
  '127': { number: '127', type: '2인실', cap: 2, floor: 1 },
  // ── 2층 (1층과 동일한 구조) ──
  '201': { number: '201', type: '4인실', cap: 4, floor: 2 },
  '202': { number: '202', type: '4인실', cap: 4, floor: 2 },
  '203': { number: '203', type: '4인실', cap: 4, floor: 2 },
  '204': { number: '204', type: '4인실', cap: 4, floor: 2 },
  '205': { number: '205', type: '4인실', cap: 4, floor: 2 },
  '206': { number: '206', type: '4인실', cap: 4, floor: 2 },
  '207': { number: '207', type: '4인실', cap: 4, floor: 2 },
  '208': { number: '208', type: '4인실', cap: 4, floor: 2 },
  '209': { number: '209', type: '1인실', cap: 1, floor: 2 },
  '210': { number: '210', type: '2인실', cap: 2, floor: 2 },
  '211': { number: '211', type: '2인실', cap: 2, floor: 2 },
  '212': { number: '212', type: '4인실', cap: 4, floor: 2 },
  '213': { number: '213', type: '4인실', cap: 4, floor: 2 },
  '214': { number: '214', type: '4인실', cap: 4, floor: 2 },
  '215': { number: '215', type: '4인실', cap: 4, floor: 2 },
  '216': { number: '216', type: '4인실', cap: 4, floor: 2 },
  '217': { number: '217', type: '4인실', cap: 4, floor: 2 },
  '218': { number: '218', type: '4인실', cap: 4, floor: 2 },
  '219': { number: '219', type: '4인실', cap: 4, floor: 2 },
  '220': { number: '220', type: '4인실', cap: 4, floor: 2 },
  '221': { number: '221', type: '4인실', cap: 4, floor: 2 },
  '222': { number: '222', type: '4인실', cap: 4, floor: 2 },
  '223': { number: '223', type: '4인실', cap: 4, floor: 2 },
  '224': { number: '224', type: '4인실', cap: 4, floor: 2 },
  '225': { number: '225', type: '4인실', cap: 4, floor: 2 },
  '226': { number: '226', type: '1인실', cap: 1, floor: 2 },
  '227': { number: '227', type: '2인실', cap: 2, floor: 2 },
};

// 도면 레이아웃 셀 정의
export interface CellDef {
  id: string;
  isLabel?: boolean;
  row: number;
  col: number;
  colSpan?: number;
}

// 그리드 크기 (CSS용)
export const FLOOR_GRID_COLS = 17;
export const FLOOR_GRID_ROWS = 13; // half-rows

// 1층 도면 레이아웃
export const FLOOR_LAYOUT_1F: CellDef[] = [
  { id: '109', row: 1, col: 5 },
  { id: '110', row: 1, col: 6 },
  { id: '111', row: 1, col: 7 },
  { id: '화장실', isLabel: true, row: 1, col: 8 },
  { id: '127', row: 1, col: 9 },
  { id: '126', row: 1, col: 10 },
  { id: '108', row: 2, col: 4 },
  { id: '107', row: 3, col: 3 },
  { id: '106', row: 4, col: 2 },
  { id: '105', row: 5, col: 1 },
  { id: '125', row: 2, col: 11 },
  { id: '124', row: 3, col: 12 },
  { id: '123', row: 4, col: 13 },
  { id: '122', row: 5, col: 14 },
  { id: '121', row: 6, col: 15 },
  { id: '120', row: 7, col: 16 },
  { id: '119', row: 8, col: 17 },
  { id: '현관', isLabel: true, row: 6, col: 7, colSpan: 2 },
  { id: '101', row: 6, col: 5 },
  { id: '102', row: 7, col: 4 },
  { id: '103', row: 8, col: 3 },
  { id: '104', row: 9, col: 2 },
  { id: '112', row: 6, col: 10 },
  { id: '113', row: 7, col: 11 },
  { id: '114', row: 8, col: 12 },
  { id: '115', row: 9, col: 13 },
  { id: '116', row: 10, col: 14 },
  { id: '117', row: 11, col: 15 },
  { id: '118', row: 12, col: 16 },
];

// 2층 도면 레이아웃 (1층과 동일한 구조, 호실 번호만 +100)
export const FLOOR_LAYOUT_2F: CellDef[] = [
  { id: '209', row: 1, col: 5 },
  { id: '210', row: 1, col: 6 },
  { id: '211', row: 1, col: 7 },
  { id: '화장실', isLabel: true, row: 1, col: 8 },
  { id: '227', row: 1, col: 9 },
  { id: '226', row: 1, col: 10 },
  { id: '208', row: 2, col: 4 },
  { id: '207', row: 3, col: 3 },
  { id: '206', row: 4, col: 2 },
  { id: '205', row: 5, col: 1 },
  { id: '225', row: 2, col: 11 },
  { id: '224', row: 3, col: 12 },
  { id: '223', row: 4, col: 13 },
  { id: '222', row: 5, col: 14 },
  { id: '221', row: 6, col: 15 },
  { id: '220', row: 7, col: 16 },
  { id: '219', row: 8, col: 17 },
  { id: '현관', isLabel: true, row: 6, col: 7, colSpan: 2 },
  { id: '201', row: 6, col: 5 },
  { id: '202', row: 7, col: 4 },
  { id: '203', row: 8, col: 3 },
  { id: '204', row: 9, col: 2 },
  { id: '212', row: 6, col: 10 },
  { id: '213', row: 7, col: 11 },
  { id: '214', row: 8, col: 12 },
  { id: '215', row: 9, col: 13 },
  { id: '216', row: 10, col: 14 },
  { id: '217', row: 11, col: 15 },
  { id: '218', row: 12, col: 16 },
];

export const FLOOR_LAYOUTS: Record<string, CellDef[]> = {
  '1': FLOOR_LAYOUT_1F,
  '2': FLOOR_LAYOUT_2F,
};

// 도면 레이아웃 (null = 빈 칸) — 하위 호환용
export type FloorCell = string | null;

export const FLOOR_PLAN: FloorCell[][] = [
  ['105', '106', '107', '108', '109', '110', '111', '119', '120', '121', '122', '123', '124', '125'],
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  ['104', '103', '102', '101', '112', '113', '114', '115', '116', '117', '118', '126', '127', null],
];
