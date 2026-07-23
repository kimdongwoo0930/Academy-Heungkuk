'use client';

import { ClassroomReservation, MealReservation, Reservation, RoomReservation } from '@/types/reservation';
import { useEffect, useMemo, useRef, useState } from 'react';
// RoomReservation used in handleRoomConfirm type annotation
import { downloadConfirmation, downloadEstimate, downloadTrade, searchReservations } from '@/lib/api/reservation';
import { getDisabledClassrooms, getDisabledRooms } from '@/lib/api/settings';
import { CLASSROOM_ROOM_TO_CATEGORY } from '@/lib/constants/classrooms';
import { ROOM_INFO, RoomType } from '@/lib/constants/rooms';
import { isAdmin } from '@/lib/utils/auth';
import { printRoomTableIntegrated } from '@/lib/utils/printRoomTable';
import { useToastStore } from '@/store/toast';
import { isAxiosError } from 'axios';
import { ko } from 'date-fns/locale';
import Script from 'next/script';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './ReservationModal.module.css';
import RoomPickerModal from './RoomPickerModal';

declare global {
    interface Window {
        daum: {
            Postcode: new (options: {
                oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => void;
            }) => { open: () => void };
        };
    }
}

function toDate(str: string): Date | null {
    if (!str) return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}
function toDateStr(d: Date | null): string {
    if (!d) return '';
    return d.toISOString().slice(0, 10);
}

const TABS = ['기본정보', '강의실', '숙박', '식수'] as const;
type Tab = (typeof TABS)[number];

const STATUS_OPTIONS = ['확정', '예약', '문의', '취소'];
const ROOM_TYPES: RoomType[] = ['1인실', '2인실', '4인실'];
const COLOR_PRESETS = [
    '#E0E0E0',
    '#BDBDBD',
    '#757575',
    '#4A90E2',
    '#0097A7',
    '#00897B',
    '#27AE60',
    '#F9C800',
    '#F5A623',
    '#E67E22',
    '#FF7043',
    '#E53935',
    '#EC008C',
    '#9B59B6',
    '#1ABC9C',
    '#F06292',
    '#795548',
    '#546E7A',
    '#7986CB',
    '#FF8A65',
    '#212121',
];

const CLASSROOM_OPTIONS = [
    '101',
    '102',
    '103',
    '105',
    '106',
    '107',
    '201',
    '202',
    '203',
    '204',
    '205',
    '206',
    'A',
    'B',
];

function classroomLabel(id: string) {
    const displayId = /^\d+$/.test(id) ? `${id}호` : id;
    const cat = CLASSROOM_ROOM_TO_CATEGORY[id];
    if (!cat) return displayId;
    const capacity = cat.match(/\d+인/)?.[0] ?? cat;
    return `${displayId} (${capacity})`;
}

interface Props {
    reservation: Reservation | null;
    allReservations: Reservation[];
    onClose: () => void;
    onSave: (data: Reservation) => void | Promise<void>;
    defaultValues?: Partial<Omit<Reservation, 'id' | 'reservationCode'>>;
}

function emptyForm(): Omit<Reservation, 'id' | 'reservationCode'> {
    return {
        organization: '',
        purpose: '',
        people: 0,
        customer: '',
        customerPhone: '',
        customerPhone2: '',
        customerEmail: '',
        startDate: '',
        endDate: '',
        colorCode: '#4A90E2',
        status: '문의',
        companyZipCode: '',
        companyAddress: '',
        businessNumber: '',
        ceoName: '',
        siteManager: '',
        siteManagerPhone: '',
        siteManagerPhone2: '',
        siteManagerEmail: '',
        billingManager: '',
        billingManagerPhone: '',
        billingManagerEmail: '',
        paymentMethod: '미정',
        memo: '',
        classrooms: [],
        rooms: [],
        meals: [],
    };
}

export default function ReservationModal({ reservation, allReservations, onClose, onSave, defaultValues }: Props) {
    const isEdit = reservation !== null;
    const globalToast = useToastStore((s) => s.show);
    const [disabledClassrooms, setDisabledClassrooms] = useState<Set<string>>(new Set());
    const [disabledRooms, setDisabledRooms] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const [estimating, setEstimating] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [trading, setTrading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const showToast = (message: string, type: 'success' | 'error' = 'error') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => setToast(null), 3000);
    };
    useEffect(
        () => () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        },
        [],
    );

    useEffect(() => {
        getDisabledClassrooms()
            .then((codes) => setDisabledClassrooms(new Set(codes)))
            .catch(() => {});
        getDisabledRooms()
            .then((codes) => setDisabledRooms(codes))
            .catch(() => {});
    }, []);

    const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const showConfirm = (message: string, onConfirm: () => void) => setConfirmDialog({ message, onConfirm });

    // 드래그
    const [pos, setPos] = useState({ dx: 0, dy: 0 });
    const dragRef = useRef<{
        startX: number;
        startY: number;
        dx: number;
        dy: number;
    } | null>(null);
    const handleDragStart = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return; // 닫기 버튼 클릭 무시
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
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    const handleTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
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
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
        };
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onUp);
    };
    const [tab, setTab] = useState<Tab>('기본정보');
    const [pickerDate, setPickerDate] = useState<string | null>(null);
    const [dateError, setDateError] = useState('');
    const [skipWeekends, setSkipWeekends] = useState(false);
    const [bulkClassrooms, setBulkClassrooms] = useState<string[]>(['']);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [bulkMeal, setBulkMeal] = useState({
        breakfast: 0,
        lunch: 0,
        dinner: 0,
    });
    const [bulkRoomPickerOpen, setBulkRoomPickerOpen] = useState(false);
    const [roomDates, setRoomDates] = useState<string[]>(() => {
        const buildRange = (start: string, end: string) => {
            const dates: string[] = [];
            const cur = new Date(start);
            const endD = new Date(end);
            while (cur < endD) {
                dates.push(cur.toISOString().slice(0, 10));
                cur.setDate(cur.getDate() + 1);
            }
            return dates;
        };
        if (isEdit) {
            const rooms = reservation.rooms ?? [];
            if (rooms.length > 0) {
                return [...new Set(rooms.map((r) => r.reservedDate))].sort();
            }
            if (reservation.startDate && reservation.endDate) {
                return buildRange(String(reservation.startDate), String(reservation.endDate));
            }
        } else if (defaultValues?.startDate && defaultValues?.endDate) {
            return buildRange(defaultValues.startDate, defaultValues.endDate);
        }
        return [];
    });
    const [showLoad, setShowLoad] = useState(false);
    const [loadResults, setLoadResults] = useState<Reservation[]>([]);
    const [loadSearching, setLoadSearching] = useState(false);
    const [showAddress, setShowAddress] = useState(
        !!(
            reservation?.companyZipCode ||
            reservation?.companyAddress ||
            reservation?.businessNumber ||
            reservation?.ceoName
        ),
    );
    const [showSiteManager, setShowSiteManager] = useState(
        !!(reservation?.siteManager || reservation?.siteManagerPhone),
    );
    const [showBillingManager, setShowBillingManager] = useState(
        !!(reservation?.billingManager || reservation?.billingManagerPhone),
    );
    const [isBillingSameAsCustomer, setIsBillingSameAsCustomer] = useState(
        !!(
            reservation?.customer &&
            reservation.customer === reservation.billingManager &&
            (reservation.customerPhone ?? '') === (reservation.billingManagerPhone ?? '') &&
            (reservation.customerEmail ?? '') === (reservation.billingManagerEmail ?? '')
        ),
    );
    const [loadSearch, setLoadSearch] = useState('');
    const [form, setForm] = useState<Omit<Reservation, 'id' | 'reservationCode'>>(
        isEdit
            ? {
                  organization: reservation.organization,
                  purpose: reservation.purpose,
                  people: reservation.people,
                  customer: reservation.customer,
                  customerPhone: reservation.customerPhone,
                  customerPhone2: reservation.customerPhone2 ?? '',
                  customerEmail: reservation.customerEmail ?? '',
                  startDate: reservation.startDate,
                  endDate: reservation.endDate,
                  colorCode: reservation.colorCode,
                  status: reservation.status,
                  companyZipCode: reservation.companyZipCode ?? '',
                  companyAddress: reservation.companyAddress ?? '',
                  businessNumber: reservation.businessNumber ?? '',
                  ceoName: reservation.ceoName ?? '',
                  siteManager: reservation.siteManager ?? '',
                  siteManagerPhone: reservation.siteManagerPhone ?? '',
                  siteManagerPhone2: reservation.siteManagerPhone2 ?? '',
                  siteManagerEmail: reservation.siteManagerEmail ?? '',
                  billingManager: reservation.billingManager ?? '',
                  billingManagerPhone: reservation.billingManagerPhone ?? '',
                  billingManagerEmail: reservation.billingManagerEmail ?? '',
                  paymentMethod: reservation.paymentMethod ?? '미정',
                  memo: reservation.memo ?? '',
                  classrooms: reservation.classrooms ? [...reservation.classrooms] : [],
                  rooms: reservation.rooms ? [...reservation.rooms] : [],
                  meals: reservation.meals ? [...reservation.meals] : [],
              }
            : { ...emptyForm(), ...defaultValues },
    );

    const initialFormRef = useRef(JSON.stringify(form));
    const isDirty = JSON.stringify(form) !== initialFormRef.current;

    const handleClose = () => {
        if (isDirty && isAdmin()) {
            showConfirm('변경사항이 저장되지 않습니다. 닫으시겠습니까?', onClose);
            return;
        }
        onClose();
    };

    const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    useEffect(() => {
        if (!showBillingManager) {
            setIsBillingSameAsCustomer(false);
            return;
        }
        if (!isBillingSameAsCustomer) return;
        setForm((prev) => {
            const nextBillingManager = prev.customer ?? '';
            const nextBillingManagerPhone = prev.customerPhone ?? '';
            const nextBillingManagerEmail = prev.customerEmail ?? '';

            if (
                prev.billingManager === nextBillingManager &&
                prev.billingManagerPhone === nextBillingManagerPhone &&
                prev.billingManagerEmail === nextBillingManagerEmail
            ) {
                return prev;
            }

            return {
                ...prev,
                billingManager: nextBillingManager,
                billingManagerPhone: nextBillingManagerPhone,
                billingManagerEmail: nextBillingManagerEmail,
            };
        });
    }, [isBillingSameAsCustomer, showBillingManager, form.customer, form.customerPhone, form.customerEmail]);

    // 불러오기: 단체명 또는 담당자명으로 API 검색 (debounce 300ms)
    useEffect(() => {
        const q = loadSearch.trim();
        if (!q) { setLoadResults([]); return; }
        setLoadSearching(true);
        const timer = setTimeout(async () => {
            try {
                const result = await searchReservations({ keyword: q, size: 100, sort: 'startDate,desc' });
                const seen = new Set<string>();
                const deduped = result.content.filter((r) => {
                    const key = `${r.organization}__${r.customer}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });
                setLoadResults(deduped);
            } catch {
                setLoadResults([]);
            } finally {
                setLoadSearching(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [loadSearch]);

    const applyLoad = (r: Reservation) => {
        setForm((prev) => ({
            ...prev,
            organization: r.organization,
            purpose: r.purpose,
            customer: r.customer,
            customerPhone: r.customerPhone,
            customerPhone2: r.customerPhone2 ?? '',
            customerEmail: r.customerEmail ?? '',
            colorCode: r.colorCode,
        }));
        setShowLoad(false);
        setLoadSearch('');
        setLoadResults([]);
    };

    // --- 날짜 범위 생성 헬퍼 ---
    const buildDateRange = (start: string, end: string): string[] => {
        const dates: string[] = [];
        const cur = new Date(start);
        const endD = new Date(end);
        while (cur <= endD) {
            dates.push(cur.toISOString().slice(0, 10));
            cur.setDate(cur.getDate() + 1);
        }
        return dates;
    };

    const isWeekday = (d: string) => {
        const day = new Date(d).getDay();
        return day !== 0 && day !== 6;
    };

    const getDateRange = () => {
        const dates = buildDateRange(form.startDate, form.endDate);
        return skipWeekends ? dates.filter(isWeekday) : dates;
    };

    // 숙박은 퇴실일(endDate) 제외
    const getRoomDateRange = () => {
        const dates = buildDateRange(form.startDate, form.endDate);
        const range = dates.slice(0, -1);
        return skipWeekends ? range.filter(isWeekday) : range;
    };

    // --- 중복 체크 ---
    // 현재 편집 중인 예약을 제외한 다른 예약들
    const otherReservations = allReservations.filter(
        (r) => r.id !== (isEdit ? reservation.id : -1) && r.status !== '취소',
    );
    const otherClassrooms = otherReservations.flatMap((r) => r.classrooms ?? []);
    const otherRooms = otherReservations.flatMap((r) => r.rooms ?? []);

    const isClassroomConflict = (c: ClassroomReservation) =>
        !!c.classroomName &&
        otherClassrooms.some((oc) => oc.classroomName === c.classroomName && oc.reservedDate === c.reservedDate);

    const isRoomConflict = (r: { roomNumber: string; reservedDate: string }) =>
        otherRooms.some((or) => or.roomNumber === r.roomNumber && or.reservedDate === r.reservedDate);

    // 특정 날짜에 다른 예약에서 이미 잡힌 호실 목록
    const getOccupiedRoomsForDate = (date: string) =>
        otherRooms.filter((r) => r.reservedDate === date).map((r) => r.roomNumber);

    // 날짜 + 강의실명이 겹치는 현재 form 내 중복
    const getClassroomInternalConflicts = () => {
        const seen = new Set<string>();
        return (form.classrooms ?? []).map((c) => {
            if (!c.classroomName) return false;
            const key = `${c.classroomName}_${c.reservedDate}`;
            const dup = seen.has(key);
            seen.add(key);
            return dup;
        });
    };

    // --- 날짜 입력 핸들러 (유효성 검사 + 자동 생성) ---
    const handleDateChange = (key: 'startDate' | 'endDate', value: string) => {
        const start = key === 'startDate' ? value : form.startDate;
        const end = key === 'endDate' ? value : form.endDate;

        if (start && end && end < start) {
            setDateError('퇴실일은 입실일보다 빠를 수 없습니다.');
            setField(key, value);
            return;
        }
        setDateError('');

        if (start && end && end >= start) {
            const allDates = buildDateRange(start, end);
            const dates = skipWeekends ? allDates.filter(isWeekday) : allDates;
            const datesSet = new Set(dates);
            const filled = bulkClassrooms.filter((c) => c !== '');

            // 기존 데이터 중 새 날짜 범위에 속하는 것 유지, 새 날짜만 빈 값 추가
            const existingClassrooms = (form.classrooms ?? []).filter((c) => datesSet.has(c.reservedDate));
            const existingClassroomDates = new Set(existingClassrooms.map((c) => c.reservedDate));
            const newClassrooms: ClassroomReservation[] = dates.flatMap((d) =>
                existingClassroomDates.has(d)
                    ? []
                    : filled.length > 0
                      ? filled.map((c) => ({ classroomName: c, reservedDate: d }))
                      : [{ classroomName: '', reservedDate: d }],
            );
            const classrooms = [...existingClassrooms, ...newClassrooms].sort((a, b) =>
                a.reservedDate < b.reservedDate ? -1 : 1,
            );

            const existingMeals = (form.meals ?? []).filter((m) => datesSet.has(m.reservedDate));
            const existingMealDates = new Set(existingMeals.map((m) => m.reservedDate));
            const newMeals: MealReservation[] = dates
                .filter((d) => !existingMealDates.has(d))
                .map((d) => ({
                    reservedDate: d,
                    breakfast: 0,
                    lunch: 0,
                    dinner: 0,
                    specialBreakfast: false,
                    specialLunch: false,
                    specialDinner: false,
                }));
            const meals = [...existingMeals, ...newMeals].sort((a, b) => (a.reservedDate < b.reservedDate ? -1 : 1));

            const roomRange = skipWeekends ? allDates.slice(0, -1).filter(isWeekday) : allDates.slice(0, -1);
            const roomRangeSet = new Set(roomRange);
            const rooms = (form.rooms ?? []).filter((r) => roomRangeSet.has(String(r.reservedDate)));

            setRoomDates(roomRange);
            setForm((prev) => ({
                ...prev,
                [key]: value,
                classrooms,
                meals,
                rooms,
            }));
        } else {
            setField(key, value);
        }
    };

    const handleSkipWeekendsChange = (checked: boolean) => {
        setSkipWeekends(checked);
        if (!form.startDate || !form.endDate) return;
        const allDates = buildDateRange(form.startDate, form.endDate);
        const dates = checked ? allDates.filter(isWeekday) : allDates;
        const filledSkip = bulkClassrooms.filter((c) => c !== '');
        const classrooms: ClassroomReservation[] = dates.flatMap((d) =>
            filledSkip.length > 0
                ? filledSkip.map((c) => ({ classroomName: c, reservedDate: d }))
                : [{ classroomName: '', reservedDate: d }],
        );
        const meals: MealReservation[] = dates.map((d) => ({
            reservedDate: d,
            breakfast: 0,
            lunch: 0,
            dinner: 0,
        }));
        const roomRange = checked ? allDates.slice(0, -1).filter(isWeekday) : allDates.slice(0, -1);
        setRoomDates(roomRange);
        setForm((prev) => ({ ...prev, classrooms, meals, rooms: [] }));
    };

    // --- 강의실 ---
    const groupedClassrooms = useMemo(() => {
        const map = new Map<string, number[]>();
        (form.classrooms ?? []).forEach((c, i) => {
            const key = c.classroomName || '__unassigned__';
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(i);
        });
        return map;
    }, [form.classrooms]);

    const toggleGroup = (key: string) =>
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    const removeGroup = (key: string) => {
        const toRemove = new Set(groupedClassrooms.get(key) ?? []);
        setField('classrooms', (form.classrooms ?? []).filter((_, i) => !toRemove.has(i)));
    };

    const addClassroom = () => {
        setField('classrooms', [...(form.classrooms ?? []), { classroomName: '', reservedDate: form.startDate || '' }]);
        setExpandedGroups((prev) => new Set(prev).add('__unassigned__'));
    };
    const removeClassroom = (i: number) =>
        setField(
            'classrooms',
            (form.classrooms ?? []).filter((_, idx) => idx !== i),
        );
    const updateClassroom = (i: number, patch: Partial<ClassroomReservation>) => {
        const updated = (form.classrooms ?? []).map((c, idx) => (idx === i ? { ...c, ...patch } : c));
        if (patch.reservedDate) updated.sort((a, b) => (a.reservedDate < b.reservedDate ? -1 : 1));
        setField('classrooms', updated);
    };

    const applyBulkClassroom = () => {
        const dates = getDateRange();
        const filled = [...new Set(bulkClassrooms.filter((c) => c !== ''))];
        setField(
            'classrooms',
            dates.flatMap((d) =>
                filled.length > 0
                    ? filled.map((c) => ({ classroomName: c, reservedDate: d }))
                    : [{ classroomName: '', reservedDate: d }],
            ),
        );
    };

    // --- 숙박 ---
    const addRoomDate = () => setRoomDates((prev) => [...prev, '']);
    const removeRoomDate = (date: string, idx: number) => {
        setRoomDates((prev) => prev.filter((_, i) => i !== idx));
        setField(
            'rooms',
            (form.rooms ?? []).filter((r) => r.reservedDate !== date),
        );
    };
    const updateRoomDate = (oldDate: string, idx: number, newDate: string) => {
        setRoomDates((prev) => {
            const updated = prev.map((d, i) => (i === idx ? newDate : d));
            return [...updated].sort();
        });
        setField(
            'rooms',
            (form.rooms ?? []).map((r) => (r.reservedDate === oldDate ? { ...r, reservedDate: newDate } : r)),
        );
    };

    // 특정 날짜에 선택된 호실 목록
    const getRoomsForDate = (date: string) =>
        (form.rooms ?? []).filter((r) => r.reservedDate === date).map((r) => r.roomNumber);

    // 날짜별 타입별 호실 수
    const countRoomsForDate = (date: string, type: RoomType) =>
        (form.rooms ?? []).filter((r) => r.reservedDate === date && ROOM_INFO[r.roomNumber]?.type === type).length;

    // 호실 선택 확인 (해당 날짜 기존 항목 교체)
    const handleRoomConfirm = (date: string, pickedRooms: string[]) => {
        const otherDates = (form.rooms ?? []).filter((r) => r.reservedDate !== date);
        const newEntries: RoomReservation[] = pickedRooms.map((num) => ({
            roomNumber: num,
            roomType: ROOM_INFO[num]?.type ?? '1인실',
            reservedDate: date,
        }));
        setField('rooms', [...otherDates, ...newEntries]);
        setPickerDate(null);
    };

    // 전체 날짜 일괄 호실 적용
    const applyBulkRooms = (pickedRooms: string[]) => {
        const dates = getRoomDateRange();
        const newEntries: RoomReservation[] = dates.flatMap((date) =>
            pickedRooms.map((num) => ({
                roomNumber: num,
                roomType: ROOM_INFO[num]?.type ?? '1인실',
                reservedDate: date,
            })),
        );
        setRoomDates(dates);
        setField('rooms', newEntries);
        setBulkRoomPickerOpen(false);
    };

    // --- 식수 ---
    const addMeal = () =>
        setField('meals', [
            ...(form.meals ?? []),
            {
                reservedDate: form.startDate || '',
                breakfast: 0,
                lunch: 0,
                dinner: 0,
                specialBreakfast: false,
                specialLunch: false,
                specialDinner: false,
            },
        ]);
    const removeMeal = (i: number) =>
        setField(
            'meals',
            (form.meals ?? []).filter((_, idx) => idx !== i),
        );
    const updateMeal = (i: number, patch: Partial<MealReservation>) => {
        const updated = (form.meals ?? []).map((m, idx) => (idx === i ? { ...m, ...patch } : m));
        if (patch.reservedDate) updated.sort((a, b) => (a.reservedDate < b.reservedDate ? -1 : 1));
        setField('meals', updated);
    };

    const applyBulkMeal = () => {
        const dates = getDateRange();
        setField(
            'meals',
            dates.map((d) => ({ reservedDate: d, ...bulkMeal })),
        );
    };

    const handleSave = async () => {
        if (saving) return;
        if (!form.organization.trim()) {
            showToast('단체명을 입력해주세요.');
            setTab('기본정보');
            return;
        }
        if (!form.customer.trim()) {
            showToast('담당자를 입력해주세요.');
            setTab('기본정보');
            return;
        }
        if (!form.customerPhone.trim()) {
            showToast('연락처를 입력해주세요.');
            setTab('기본정보');
            return;
        }
        if (!form.customerEmail?.trim()) {
            showToast('이메일을 입력해주세요.');
            setTab('기본정보');
            return;
        }
        if (!form.startDate || !form.endDate) {
            showToast('날짜를 입력해주세요.');
            setTab('기본정보');
            return;
        }
        if (dateError) {
            showToast(dateError);
            setTab('기본정보');
            return;
        }

        // 강의실 중복 체크
        const conflictedClassrooms = (form.classrooms ?? []).filter(isClassroomConflict);
        if (conflictedClassrooms.length > 0) {
            const list = conflictedClassrooms.map((c) => `${c.reservedDate} ${c.classroomName}호`).join(', ');
            showToast(`강의실 중복: ${list}`);
            setTab('강의실');
            return;
        }

        // 강의실 내부 중복 체크 (같은 날짜 + 같은 강의실 두 번)
        const internalDups = getClassroomInternalConflicts();
        if (internalDups.some(Boolean)) {
            const dupItems = (form.classrooms ?? []).filter((_, i) => internalDups[i]);
            const list = dupItems.map((c) => `${c.reservedDate} ${c.classroomName}호`).join(', ');
            showToast(`강의실 중복 입력: ${list}`);
            setTab('강의실');
            return;
        }

        // 숙박 호실 중복 체크
        const conflictedRooms = (form.rooms ?? []).filter(isRoomConflict);
        if (conflictedRooms.length > 0) {
            const list = conflictedRooms.map((r) => `${r.reservedDate} ${r.roomNumber}호`).join(', ');
            showToast(`호실 중복: ${list}`);
            setTab('숙박');
            return;
        }

        setSaving(true);
        try {
            await onSave({
                id: isEdit ? reservation.id : Date.now(),
                reservationCode: isEdit ? reservation.reservationCode : `HK-${Date.now()}`,
                ...form,
            });
            globalToast('저장되었습니다.', 'success');
            onClose();
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            showToast(status === 403 ? '권한이 없습니다.' : '저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />
            <div className={styles.overlay}>
                <div className={styles.modal} style={{ transform: `translate(${pos.dx}px, ${pos.dy}px)` }}>
                    <div className={styles.modalHeader} onMouseDown={handleDragStart} onTouchStart={handleTouchStart}>
                        <div>
                            <div className={styles.modalTitleRow}>
                                <h3 className={styles.modalTitle}>{isEdit ? '예약 상세 / 수정' : '예약 등록'}</h3>
                                <select
                                    className={`${styles.statusBadge} ${styles[`status_${form.status}`]}`}
                                    value={form.status}
                                    onChange={(e) => setField('status', e.target.value)}
                                >
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <p className={styles.reqNote}>
                                <span className={styles.req}>*</span> 필수 입력 항목
                            </p>
                        </div>
                        <button className={styles.closeBtn} onClick={handleClose}>
                            ✕
                        </button>
                    </div>

                    {/* 탭 */}
                    <div className={styles.tabs}>
                        {TABS.map((t) => (
                            <button
                                key={t}
                                className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`}
                                onClick={() => setTab(t)}
                            >
                                {t}
                            </button>
                        ))}
                        {isEdit && reservation.createdAt && (
                            <span className={styles.createdAt}>등록일 {reservation.createdAt.slice(0, 10)}</span>
                        )}
                    </div>

                    <div className={styles.body}>
                        {/* 기본정보 */}
                        {tab === '기본정보' && (
                            <div className={styles.grid}>
                                {!isEdit && (
                                    <div className={`${styles.fullWidth} ${styles.loadWrap}`}>
                                        <button className={styles.loadBtn} onClick={() => setShowLoad(true)}>
                                            이전 예약에서 불러오기
                                        </button>
                                    </div>
                                )}
                                {/* 섹션: 기본 정보 */}
                                <div className={`${styles.sectionLabel} ${styles.fullWidth}`}>기본 정보</div>
                                <div className={`${styles.fullWidth} ${styles.grid3}`}>
                                    <label className={styles.label}>
                                        <span>
                                            단체명 <span className={styles.req}>*</span>
                                        </span>
                                        <input
                                            className={styles.input}
                                            value={form.organization}
                                            onChange={(e) => setField('organization', e.target.value)}
                                            placeholder="단체명"
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        교육명
                                        <input
                                            className={styles.input}
                                            value={form.purpose}
                                            onChange={(e) => setField('purpose', e.target.value)}
                                            placeholder="교육명"
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        <span>
                                            인원 <span className={styles.req}>*</span>
                                        </span>
                                        <input
                                            className={styles.input}
                                            type="number"
                                            min={0}
                                            placeholder="0"
                                            value={form.people === 0 ? '' : form.people}
                                            onChange={(e) =>
                                                setField('people', e.target.value === '' ? 0 : Number(e.target.value))
                                            }
                                        />
                                    </label>
                                </div>

                                {/* 섹션: 연락처 */}
                                <div className={`${styles.sectionDivider} ${styles.fullWidth}`} />
                                <div className={`${styles.sectionLabelRow} ${styles.contactControlBar} ${styles.fullWidth}`}>
                                    <span className={styles.sectionLabel}>담당자 정보</span>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={showSiteManager}
                                            onChange={(e) => setShowSiteManager(e.target.checked)}
                                        />
                                        현장 담당자
                                    </label>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={showBillingManager}
                                            onChange={(e) => setShowBillingManager(e.target.checked)}
                                        />
                                        정산 담당자
                                    </label>
                                    <label className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={showAddress}
                                            onChange={(e) => setShowAddress(e.target.checked)}
                                        />
                                        단체 추가 정보
                                    </label>
                                </div>
                                {/* 신청인 행 */}
                                <div className={`${styles.fullWidth} ${styles.grid4contact}`}>
                                    <label className={styles.label}>
                                        <span>
                                            신청인 <span className={styles.req}>*</span>
                                        </span>
                                        <input
                                            className={styles.input}
                                            value={form.customer}
                                            onChange={(e) => setField('customer', e.target.value)}
                                            placeholder="담당자명"
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        <span>
                                            연락처 <span className={styles.req}>*</span>
                                        </span>
                                        <input
                                            className={styles.input}
                                            value={form.customerPhone}
                                            onChange={(e) => setField('customerPhone', e.target.value)}
                                            placeholder="010-0000-0000"
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        연락처2
                                        <input
                                            className={styles.input}
                                            value={form.customerPhone2 ?? ''}
                                            onChange={(e) => setField('customerPhone2', e.target.value)}
                                            placeholder="(선택)"
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        <span>
                                            이메일 <span className={styles.req}>*</span>
                                        </span>
                                        <input
                                            className={styles.input}
                                            value={form.customerEmail ?? ''}
                                            onChange={(e) => setField('customerEmail', e.target.value)}
                                            placeholder="이메일"
                                        />
                                    </label>
                                </div>
                                {/* 현장 담당자 행 */}
                                {showSiteManager && (
                                    <div className={`${styles.fullWidth} ${styles.grid4contact} ${styles.siteManagerRow}`}>
                                        <label className={styles.label}>
                                            현장 담당자
                                            <input
                                                className={styles.input}
                                                value={form.siteManager ?? ''}
                                                onChange={(e) => setField('siteManager', e.target.value)}
                                                placeholder="담당자 이름"
                                            />
                                        </label>
                                        <label className={styles.label}>
                                            연락처
                                            <input
                                                className={styles.input}
                                                value={form.siteManagerPhone ?? ''}
                                                onChange={(e) => setField('siteManagerPhone', e.target.value)}
                                                placeholder="010-0000-0000"
                                            />
                                        </label>
                                        <label className={styles.label}>
                                            연락처2
                                            <input
                                                className={styles.input}
                                                value={form.siteManagerPhone2 ?? ''}
                                                onChange={(e) => setField('siteManagerPhone2', e.target.value)}
                                                placeholder="(선택)"
                                            />
                                        </label>
                                        <label className={styles.label}>
                                            이메일
                                            <input
                                                className={styles.input}
                                                value={form.siteManagerEmail ?? ''}
                                                onChange={(e) => setField('siteManagerEmail', e.target.value)}
                                                placeholder="이메일"
                                            />
                                        </label>
                                    </div>
                                )}
                                {/* 정산 담당자 + 정산 방법 행 */}
                                {showBillingManager && (
                                    <div className={`${styles.fullWidth} ${styles.billingSection}`}>
                                        <div className={styles.billingSectionTitle}>정산 정보</div>
                                        <div className={styles.billingSameRow}>
                                            <label className={`${styles.checkboxLabel} ${styles.billingSameCheckbox}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={isBillingSameAsCustomer}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setIsBillingSameAsCustomer(checked);
                                                        if (!checked) {
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                billingManager: '',
                                                                billingManagerPhone: '',
                                                                billingManagerEmail: '',
                                                            }));
                                                            return;
                                                        }
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            billingManager: prev.customer ?? '',
                                                            billingManagerPhone: prev.customerPhone ?? '',
                                                            billingManagerEmail: prev.customerEmail ?? '',
                                                        }));
                                                    }}
                                                />
                                                신청인 정보와 동일
                                            </label>
                                        </div>
                                        <div className={styles.grid4billing}>
                                            <label className={styles.label}>
                                                정산 방법
                                                <select
                                                    className={styles.select}
                                                    value={form.paymentMethod ?? '미정'}
                                                    onChange={(e) => setField('paymentMethod', e.target.value)}
                                                >
                                                    <option value="미정">미정</option>
                                                    <option value="카드">카드</option>
                                                    <option value="세금계산서">세금계산서</option>
                                                    <option value="계산서">계산서</option>
                                                </select>
                                            </label>
                                            <label className={styles.label}>
                                                정산 담당자
                                                <input
                                                    className={styles.input}
                                                    value={form.billingManager ?? ''}
                                                    onChange={(e) => setField('billingManager', e.target.value)}
                                                    disabled={isBillingSameAsCustomer}
                                                    placeholder="담당자 이름"
                                                />
                                            </label>
                                            <label className={styles.label}>
                                                연락처
                                                <input
                                                    className={styles.input}
                                                    value={form.billingManagerPhone ?? ''}
                                                    onChange={(e) => setField('billingManagerPhone', e.target.value)}
                                                    disabled={isBillingSameAsCustomer}
                                                    placeholder="010-0000-0000"
                                                />
                                            </label>
                                            <label className={styles.label}>
                                                이메일
                                                <input
                                                    className={styles.input}
                                                    value={form.billingManagerEmail ?? ''}
                                                    onChange={(e) => setField('billingManagerEmail', e.target.value)}
                                                    disabled={isBillingSameAsCustomer}
                                                    placeholder="이메일"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}
                                {/* 단체 추가 정보 */}
                                {showAddress && (
                                    <div className={`${styles.fullWidth} ${styles.extraInfoSection}`}>
                                        <div className={styles.extraInfoSectionTitle}>단체 추가 정보</div>
                                        <div className={styles.addressRow}>
                                            <label className={styles.label}>
                                                우편번호
                                                <div className={styles.zipRow}>
                                                    <input
                                                        className={styles.input}
                                                        value={form.companyZipCode ?? ''}
                                                        onChange={(e) => setField('companyZipCode', e.target.value)}
                                                        placeholder="우편번호"
                                                        readOnly
                                                    />
                                                    <button
                                                        type="button"
                                                        className={styles.zipSearchBtn}
                                                        onClick={() => {
                                                            new window.daum.Postcode({
                                                                oncomplete: (data: {
                                                                    zonecode: string;
                                                                    roadAddress: string;
                                                                    jibunAddress: string;
                                                                }) => {
                                                                    setField('companyZipCode', data.zonecode);
                                                                    setField(
                                                                        'companyAddress',
                                                                        data.roadAddress || data.jibunAddress,
                                                                    );
                                                                },
                                                            }).open();
                                                        }}
                                                    >
                                                        주소 검색
                                                    </button>
                                                </div>
                                            </label>
                                            <label className={`${styles.label} ${styles.addressField}`}>
                                                주소
                                                <input
                                                    className={styles.input}
                                                    value={form.companyAddress ?? ''}
                                                    onChange={(e) => setField('companyAddress', e.target.value)}
                                                    placeholder="도로명 주소"
                                                />
                                            </label>
                                        </div>
                                        <div className={styles.grid2}>
                                            <label className={styles.label}>
                                                사업자번호
                                                <input
                                                    className={styles.input}
                                                    value={form.businessNumber ?? ''}
                                                    onChange={(e) => setField('businessNumber', e.target.value)}
                                                    placeholder="000-00-00000"
                                                />
                                            </label>
                                            <label className={styles.label}>
                                                대표이사명
                                                <input
                                                    className={styles.input}
                                                    value={form.ceoName ?? ''}
                                                    onChange={(e) => setField('ceoName', e.target.value)}
                                                    placeholder="대표이사명"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {/* 섹션: 일정 */}
                                <div className={`${styles.sectionDivider} ${styles.fullWidth}`} />
                                <div className={`${styles.sectionLabelRow} ${styles.contactControlBar} ${styles.fullWidth}`}>
                                    <div className={styles.sectionLabel}>교육일정</div>
                                    <label className={`${styles.checkboxLabel} ${styles.scheduleWeekendToggle}`}>
                                        <input
                                            type="checkbox"
                                            checked={skipWeekends}
                                            onChange={(e) => handleSkipWeekendsChange(e.target.checked)}
                                        />
                                        주말 제외
                                    </label>
                                </div>
                                <div className={`${styles.fullWidth} ${styles.dateRow}`}>
                                    <div className={styles.dateField}>
                                        <span className={styles.labelText}>
                                            입실일 <span className={styles.req}>*</span>
                                        </span>
                                        <DatePicker
                                            selected={toDate(form.startDate)}
                                            onChange={(d: Date | null) => handleDateChange('startDate', toDateStr(d))}
                                            locale={ko}
                                            dateFormat="yyyy-MM-dd (eee)"
                                            className={styles.input}
                                            placeholderText="날짜 선택"
                                            popperProps={{ strategy: 'fixed' }}
                                            popperPlacement="bottom-start"
                                        />
                                    </div>
                                    <div className={styles.dateField}>
                                        <span className={styles.labelText}>
                                            퇴실일 <span className={styles.req}>*</span>
                                        </span>
                                        <DatePicker
                                            selected={toDate(form.endDate)}
                                            onChange={(d: Date | null) => handleDateChange('endDate', toDateStr(d))}
                                            minDate={toDate(form.startDate) ?? undefined}
                                            locale={ko}
                                            dateFormat="yyyy-MM-dd (eee)"
                                            className={`${styles.input} ${dateError ? styles.inputError : ''}`}
                                            placeholderText="날짜 선택"
                                            popperProps={{ strategy: 'fixed' }}
                                            popperPlacement="bottom-start"
                                        />
                                    </div>
                                </div>
                                {dateError && <p className={`${styles.dateError} ${styles.fullWidth}`}>{dateError}</p>}
                                <div className={`${styles.fullWidth} ${styles.memoColorRow}`}>
                                    <label className={`${styles.label} ${styles.memoFlex}`}>
                                        메모
                                        <textarea
                                            className={styles.textarea}
                                            value={form.memo ?? ''}
                                            onChange={(e) => setField('memo', e.target.value)}
                                            placeholder="특이사항 메모"
                                        />
                                    </label>
                                    <label className={styles.label}>
                                        색상
                                        <div className={styles.colorGrid}>
                                            {COLOR_PRESETS.map((c) => (
                                                <button
                                                    key={c}
                                                    className={`${styles.colorSwatch} ${form.colorCode === c ? styles.colorSelected : ''}`}
                                                    style={{ backgroundColor: c }}
                                                    onClick={() => setField('colorCode', c)}
                                                />
                                            ))}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* 강의실 */}
                        {tab === '강의실' && (
                            <div>
                                <div className={styles.classroomStickyTop}>
                                    {/* 전체 설정 */}
                                    <div className={styles.bulkRow}>
                                        <span className={styles.bulkLabel}>전체 날짜 일괄 적용</span>
                                        <div className={styles.bulkClassroomList}>
                                            {bulkClassrooms.map((bc, bi) => (
                                                <div key={bi} className={styles.bulkClassroomItem}>
                                                    <select
                                                        className={styles.cellSelect}
                                                        value={bc}
                                                        onChange={(e) =>
                                                            setBulkClassrooms((prev) =>
                                                                prev.map((v, idx) => (idx === bi ? e.target.value : v)),
                                                            )
                                                        }
                                                    >
                                                        <option value="">강의실 선택</option>
                                                        {CLASSROOM_OPTIONS
                                                            .filter((o) => !disabledClassrooms.has(o) && !bulkClassrooms.some((v, idx) => idx !== bi && v === o))
                                                            .map((o) => (
                                                            <option key={o} value={o}>
                                                                {classroomLabel(o)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {bulkClassrooms.length > 1 && (
                                                        <button
                                                            className={styles.removeBulkBtn}
                                                            onClick={() =>
                                                                setBulkClassrooms((prev) =>
                                                                    prev.filter((_, idx) => idx !== bi),
                                                                )
                                                            }
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            className={styles.addBulkBtn}
                                            onClick={() => setBulkClassrooms((prev) => [...prev, ''])}
                                        >
                                            + 강의실
                                        </button>
                                        <button className={styles.applyBtn} onClick={applyBulkClassroom}>
                                            전체 적용
                                        </button>
                                    </div>
                                    <div className={styles.listHeader}>
                                        <span className={styles.listCount}>총 {(form.classrooms ?? []).length}건</span>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {(form.classrooms ?? []).length > 0 && (
                                                <button
                                                    className={styles.removeAllBtn}
                                                    onClick={() => {
                                                        if (confirm('강의실 배정 전체를 삭제하시겠습니까?')) {
                                                            const uniqueDates = [
                                                                ...new Set(
                                                                    (form.classrooms ?? []).map((c) => c.reservedDate),
                                                                ),
                                                            ];
                                                            setField(
                                                                'classrooms',
                                                                uniqueDates.map((date) => ({
                                                                    classroomName: '',
                                                                    reservedDate: date,
                                                                })),
                                                            );
                                                        }
                                                    }}
                                                >
                                                    전체 제거
                                                </button>
                                            )}
                                            <button className={styles.addRowBtn} onClick={addClassroom}>
                                                + 추가
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {(form.classrooms ?? []).length === 0 ? (
                                    <p className={styles.empty}>강의실 배정 내역이 없습니다.</p>
                                ) : (
                                    <div className={styles.classroomGroups}>
                                        {(() => {
                                            const internalDups = getClassroomInternalConflicts();
                                            return Array.from(groupedClassrooms.entries()).map(([key, indices]) => {
                                                const isUnassigned = key === '__unassigned__';
                                                const isExpanded = expandedGroups.has(key);
                                                const groupHasConflict = indices.some((i) => {
                                                    const c = (form.classrooms ?? [])[i];
                                                    return isClassroomConflict(c) || internalDups[i];
                                                });
                                                const label = isUnassigned ? '미지정' : classroomLabel(key);

                                                return (
                                                    <div key={key} className={styles.classroomGroup}>
                                                        <button
                                                            className={`${styles.classroomGroupHeader} ${groupHasConflict ? styles.classroomGroupConflict : ''}`}
                                                            onClick={() => toggleGroup(key)}
                                                        >
                                                            <span className={styles.groupArrow}>{isExpanded ? '▼' : '▶'}</span>
                                                            <span className={styles.groupLabel}>{label}</span>
                                                            <span className={styles.groupCount}>— {indices.length}일</span>
                                                            {groupHasConflict && (
                                                                <span className={styles.groupConflictBadge}>⚠ 중복</span>
                                                            )}
                                                            <span style={{ flex: 1 }} />
                                                            <span
                                                                className={styles.groupRemoveBtn}
                                                                role="button"
                                                                onClick={(e) => { e.stopPropagation(); removeGroup(key); }}
                                                            >✕</span>
                                                        </button>
                                                        {isExpanded && (
                                                            <div className={styles.classroomGroupBody}>
                                                                {indices.map((i) => {
                                                                    const c = (form.classrooms ?? [])[i];
                                                                    const extConflict = isClassroomConflict(c);
                                                                    const intConflict = internalDups[i];
                                                                    const hasConflict = extConflict || intConflict;
                                                                    return (
                                                                        <div
                                                                            key={i}
                                                                            className={`${styles.classroomDateRow} ${hasConflict ? styles.classroomDateRowConflict : ''}`}
                                                                        >
                                                                            {isUnassigned && (
                                                                                <select
                                                                                    className={styles.cellSelect}
                                                                                    value={c.classroomName}
                                                                                    onChange={(e) => updateClassroom(i, { classroomName: e.target.value })}
                                                                                >
                                                                                    <option value="">강의실 선택</option>
                                                                                    {CLASSROOM_OPTIONS.filter((o) => !disabledClassrooms.has(o)).map((o) => (
                                                                                        <option key={o} value={o}>{classroomLabel(o)}</option>
                                                                                    ))}
                                                                                </select>
                                                                            )}
                                                                            <DatePicker
                                                                                selected={toDate(c.reservedDate)}
                                                                                onChange={(d: Date | null) => updateClassroom(i, { reservedDate: toDateStr(d) })}
                                                                                locale={ko}
                                                                                dateFormat="yyyy-MM-dd (eee)"
                                                                                className={styles.cellInput}
                                                                                popperProps={{ strategy: 'fixed' }}
                                                                                popperPlacement="bottom-start"
                                                                            />
                                                                            {hasConflict && (
                                                                                <span className={styles.conflictBadge} title={extConflict ? '다른 예약과 중복' : '내부 중복'}>
                                                                                    ⚠ {extConflict ? '중복' : '내부중복'}
                                                                                </span>
                                                                            )}
                                                                            <button className={styles.removeBtn} onClick={() => removeClassroom(i)}>✕</button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 숙박 */}
                        {tab === '숙박' && (
                            <div>
                                {!form.startDate || !form.endDate ? (
                                    <p className={styles.empty}>기본정보 탭에서 입실일·퇴실일을 먼저 입력해주세요.</p>
                                ) : (
                                    <>
                                        <div className={styles.classroomStickyTop}>
                                            <div className={styles.bulkRow}>
                                                <span className={styles.bulkLabel}>전체 날짜 일괄 적용</span>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button
                                                        className={styles.applyBtn}
                                                        onClick={() => setBulkRoomPickerOpen(true)}
                                                    >
                                                        호실 일괄 지정
                                                    </button>
                                                </div>
                                            </div>
                                            <div className={styles.listHeader}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className={styles.listCount}>총 {roomDates.length}일</span>
                                                    <button
                                                        className={styles.roomPrintBtn}
                                                        onClick={() =>
                                                            printRoomTableIntegrated(
                                                                roomDates,
                                                                form.rooms ?? [],
                                                                form.organization ?? '',
                                                            )
                                                        }
                                                    >
                                                        🖨 통합 숙소표
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {(form.rooms ?? []).length > 0 && (
                                                        <button
                                                            className={styles.removeAllBtn}
                                                            onClick={() => {
                                                                if (
                                                                    confirm(
                                                                        '숙박 날짜 및 호실 배정 전체를 삭제하시겠습니까?',
                                                                    )
                                                                ) {
                                                                    setRoomDates([]);
                                                                    setField('rooms', []);
                                                                }
                                                            }}
                                                        >
                                                            전체 제거
                                                        </button>
                                                    )}
                                                    <button className={styles.addRowBtn} onClick={addRoomDate}>
                                                        + 추가
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <table className={styles.listTable}>
                                            <thead>
                                                <tr>
                                                    <th>날짜</th>
                                                    <th>1인실</th>
                                                    <th>2인실</th>
                                                    <th>4인실</th>
                                                    <th>합계</th>
                                                    <th>호실 지정</th>
                                                    <th></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {roomDates.map((date, idx) => {
                                                    const total = (form.rooms ?? []).filter(
                                                        (r) => r.reservedDate === date,
                                                    ).length;
                                                    const roomsForDate = (form.rooms ?? []).filter(
                                                        (r) => r.reservedDate === date,
                                                    );
                                                    const conflictCount = roomsForDate.filter(isRoomConflict).length;
                                                    return (
                                                        <tr
                                                            key={idx}
                                                            className={conflictCount > 0 ? styles.conflictRow : ''}
                                                        >
                                                            <td>
                                                                <DatePicker
                                                                    selected={toDate(date)}
                                                                    onChange={(d: Date | null) =>
                                                                        updateRoomDate(date, idx, toDateStr(d))
                                                                    }
                                                                    locale={ko}
                                                                    dateFormat="yyyy-MM-dd (eee)"
                                                                    className={styles.cellInput}
                                                                    popperProps={{ strategy: 'fixed' }}
                                                                    popperPlacement="bottom-start"
                                                                />
                                                            </td>
                                                            {ROOM_TYPES.map((type) => (
                                                                <td key={type} className={styles.countCell}>
                                                                    {countRoomsForDate(date, type) > 0 ? (
                                                                        <span
                                                                            className={`${styles.roomCountBadge} ${styles[`roomCountBadge${type.charAt(0)}`]}`}
                                                                        >
                                                                            {countRoomsForDate(date, type)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className={styles.zeroCount}>-</span>
                                                                    )}
                                                                </td>
                                                            ))}
                                                            <td className={styles.countCell}>
                                                                {total > 0 ? <strong>{total}</strong> : '-'}
                                                                {conflictCount > 0 && (
                                                                    <span
                                                                        className={styles.conflictBadge}
                                                                        title="중복 호실 있음"
                                                                    >
                                                                        {' '}
                                                                        ⚠ {conflictCount}개 중복
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className={styles.pickBtn}
                                                                    onClick={() => setPickerDate(date)}
                                                                    disabled={!date}
                                                                >
                                                                    호실 지정
                                                                </button>
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className={styles.removeBtn}
                                                                    onClick={() => removeRoomDate(date, idx)}
                                                                >
                                                                    ✕
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </>
                                )}
                            </div>
                        )}

                        {/* 식수 */}
                        {tab === '식수' && (
                            <div>
                                <div className={styles.classroomStickyTop}>
                                    {/* 전체 설정 */}
                                    <div className={styles.bulkRow}>
                                        <span className={styles.bulkLabel}>전체 날짜 일괄 적용</span>
                                        <label className={styles.bulkMealLabel}>
                                            조식
                                            <input
                                                className={styles.bulkInputSm}
                                                type="number"
                                                min={0}
                                                value={bulkMeal.breakfast || ''}
                                                onChange={(e) =>
                                                    setBulkMeal((p) => ({
                                                        ...p,
                                                        breakfast: Number(e.target.value),
                                                    }))
                                                }
                                                placeholder="0"
                                            />
                                        </label>
                                        <label className={styles.bulkMealLabel}>
                                            중식
                                            <input
                                                className={styles.bulkInputSm}
                                                type="number"
                                                min={0}
                                                value={bulkMeal.lunch || ''}
                                                onChange={(e) =>
                                                    setBulkMeal((p) => ({
                                                        ...p,
                                                        lunch: Number(e.target.value),
                                                    }))
                                                }
                                                placeholder="0"
                                            />
                                        </label>
                                        <label className={styles.bulkMealLabel}>
                                            석식
                                            <input
                                                className={styles.bulkInputSm}
                                                type="number"
                                                min={0}
                                                value={bulkMeal.dinner || ''}
                                                onChange={(e) =>
                                                    setBulkMeal((p) => ({
                                                        ...p,
                                                        dinner: Number(e.target.value),
                                                    }))
                                                }
                                                placeholder="0"
                                            />
                                        </label>
                                        <button className={styles.applyBtn} onClick={applyBulkMeal}>
                                            전체 적용
                                        </button>
                                    </div>
                                    <div className={styles.listHeader}>
                                        <span className={styles.listCount}>총 {(form.meals ?? []).length}건</span>
                                        <button className={styles.addRowBtn} onClick={addMeal}>
                                            + 추가
                                        </button>
                                    </div>
                                </div>
                                {(form.meals ?? []).length === 0 ? (
                                    <p className={styles.empty}>식수 내역이 없습니다.</p>
                                ) : (
                                    <table className={styles.listTable}>
                                        <thead>
                                            <tr>
                                                <th>날짜</th>
                                                <th>조식</th>
                                                <th>중식</th>
                                                <th>석식</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(form.meals ?? []).map((m, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <DatePicker
                                                            selected={toDate(m.reservedDate)}
                                                            onChange={(d: Date | null) =>
                                                                updateMeal(i, { reservedDate: toDateStr(d) })
                                                            }
                                                            locale={ko}
                                                            dateFormat="yyyy-MM-dd (eee)"
                                                            className={styles.cellInput}
                                                            popperProps={{ strategy: 'fixed' }}
                                                            popperPlacement="bottom-start"
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className={styles.mealCellWrap}>
                                                            <input
                                                                className={styles.cellInputSm}
                                                                type="number"
                                                                value={m.breakfast || ''}
                                                                onChange={(e) =>
                                                                    updateMeal(i, {
                                                                        breakfast: Number(e.target.value),
                                                                    })
                                                                }
                                                                placeholder="0"
                                                            />
                                                            <button
                                                                type="button"
                                                                className={`${styles.specialToggle} ${m.specialBreakfast ? styles.specialToggleOn : ''}`}
                                                                onClick={() =>
                                                                    updateMeal(i, {
                                                                        specialBreakfast: !m.specialBreakfast,
                                                                    })
                                                                }
                                                            >
                                                                특식
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={styles.mealCellWrap}>
                                                            <input
                                                                className={styles.cellInputSm}
                                                                type="number"
                                                                value={m.lunch || ''}
                                                                onChange={(e) =>
                                                                    updateMeal(i, { lunch: Number(e.target.value) })
                                                                }
                                                                placeholder="0"
                                                            />
                                                            <button
                                                                type="button"
                                                                className={`${styles.specialToggle} ${m.specialLunch ? styles.specialToggleOn : ''}`}
                                                                onClick={() =>
                                                                    updateMeal(i, { specialLunch: !m.specialLunch })
                                                                }
                                                            >
                                                                특식
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className={styles.mealCellWrap}>
                                                            <input
                                                                className={styles.cellInputSm}
                                                                type="number"
                                                                value={m.dinner || ''}
                                                                onChange={(e) =>
                                                                    updateMeal(i, {
                                                                        dinner: Number(e.target.value),
                                                                    })
                                                                }
                                                                placeholder="0"
                                                            />
                                                            <button
                                                                type="button"
                                                                className={`${styles.specialToggle} ${m.specialDinner ? styles.specialToggleOn : ''}`}
                                                                onClick={() =>
                                                                    updateMeal(i, {
                                                                        specialDinner: !m.specialDinner,
                                                                    })
                                                                }
                                                            >
                                                                특식
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button
                                                            className={styles.removeBtn}
                                                            onClick={() => removeMeal(i)}
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={styles.footer}>
                        <div className={styles.footerLeft}>
                            {isEdit && reservation.id && isAdmin() && (
                                <>
                                    <button
                                        className={styles.tradeBtn}
                                        disabled={trading}
                                        onClick={async () => {
                                            setTrading(true);
                                            try {
                                                await downloadTrade(reservation.id, reservation.organization);
                                            } catch (err) {
                                                showToast(
                                                    isAxiosError(err) && err.response?.status === 403
                                                        ? '권한이 없습니다.'
                                                        : '거래명세서 생성에 실패했습니다.',
                                                );
                                            } finally {
                                                setTrading(false);
                                            }
                                        }}
                                    >
                                        {trading ? '생성 중...' : '거래명세서'}
                                    </button>
                                    <button
                                        className={styles.confirmationBtn}
                                        disabled={confirming}
                                        onClick={async () => {
                                            setConfirming(true);
                                            try {
                                                await downloadConfirmation(reservation.id, reservation.organization);
                                            } catch (err) {
                                                showToast(
                                                    isAxiosError(err) && err.response?.status === 403
                                                        ? '권한이 없습니다.'
                                                        : '확인서 생성에 실패했습니다.',
                                                );
                                            } finally {
                                                setConfirming(false);
                                            }
                                        }}
                                    >
                                        {confirming ? '생성 중...' : '확인서'}
                                    </button>
                                    <button
                                        className={styles.estimateBtn}
                                        disabled={estimating}
                                        onClick={async () => {
                                            setEstimating(true);
                                            try {
                                                await downloadEstimate(reservation.id, reservation.organization);
                                            } catch (err) {
                                                showToast(
                                                    isAxiosError(err) && err.response?.status === 403
                                                        ? '권한이 없습니다.'
                                                        : '견적서 생성에 실패했습니다.',
                                                );
                                            } finally {
                                                setEstimating(false);
                                            }
                                        }}
                                    >
                                        {estimating ? '생성 중...' : '견적서'}
                                    </button>
                                </>
                            )}
                        </div>
                        <div className={styles.footerRight}>
                            <button className={styles.cancelBtn} onClick={handleClose}>
                                닫기
                            </button>
                            <button
                                className={styles.saveBtn}
                                onClick={handleSave}
                                disabled={saving || (!isDirty && isEdit)}
                            >
                                {saving ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 토스트 알림 */}
                {toast && <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>{toast.message}</div>}

                {/* 이전 예약 검색 팝업 */}
                {showLoad && (
                    <div className={styles.loadOverlay} onClick={() => { setShowLoad(false); setLoadSearch(''); setLoadResults([]); }}>
                        <div className={styles.loadPopup} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.loadPopupHeader}>
                                <span className={styles.loadPopupTitle}>이전 예약 불러오기</span>
                                <button className={styles.loadPopupClose} onClick={() => { setShowLoad(false); setLoadSearch(''); setLoadResults([]); }}>✕</button>
                            </div>
                            <div className={styles.loadPopupSearch}>
                                <input
                                    className={styles.loadInput}
                                    autoFocus
                                    placeholder="단체명 또는 담당자명을 입력하세요."
                                    value={loadSearch}
                                    onChange={(e) => setLoadSearch(e.target.value)}
                                />
                                <button className={styles.loadSearchBtn} disabled={loadSearching}>검색</button>
                            </div>
                            <div className={styles.loadTableWrap}>
                                {loadSearch.trim() === '' ? (
                                    <p className={styles.loadEmpty}>검색어를 입력하세요.</p>
                                ) : loadSearching ? (
                                    <p className={styles.loadEmpty}>검색 중...</p>
                                ) : loadResults.length === 0 ? (
                                    <p className={styles.loadEmpty}>검색 결과가 없습니다.</p>
                                ) : (
                                    <table className={styles.loadTable}>
                                        <thead>
                                            <tr>
                                                <th>번호</th>
                                                <th>상태</th>
                                                <th>입실일</th>
                                                <th>단체명</th>
                                                <th>담당자</th>
                                                <th>연락처</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadResults.map((r, i) => (
                                                <tr key={r.id} className={styles.loadTableRow} onClick={() => applyLoad(r)}>
                                                    <td className={styles.loadTdNum}>{i + 1}</td>
                                                    <td>
                                                        <span className={`${styles.loadStatusBadge} ${styles[`loadStatus_${r.status}`]}`}>
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td className={styles.loadTdDate}>{String(r.startDate)}</td>
                                                    <td className={styles.loadTdOrg}>
                                                        <span className={styles.loadColorDot} style={{ backgroundColor: r.colorCode }} />
                                                        {r.organization}
                                                    </td>
                                                    <td className={styles.loadTdCustomer}>{r.customer}</td>
                                                    <td className={styles.loadTdPhone}>{r.customerPhone}</td>
                                                    <td><button className={styles.loadSelectBtn}>선택</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            {loadResults.length > 0 && (
                                <div className={styles.loadPopupFooter}>전체 {loadResults.length}건</div>
                            )}
                        </div>
                    </div>
                )}

                {/* 확인 다이얼로그 */}
                {confirmDialog && (
                    <div className={styles.confirmOverlay}>
                        <div className={styles.confirmBox}>
                            <p className={styles.confirmMsg}>{confirmDialog.message}</p>
                            <div className={styles.confirmBtns}>
                                <button className={styles.confirmCancelBtn} onClick={() => setConfirmDialog(null)}>
                                    취소
                                </button>
                                <button
                                    className={styles.confirmOkBtn}
                                    onClick={() => {
                                        setConfirmDialog(null);
                                        confirmDialog.onConfirm();
                                    }}
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 호실 선택 도면 모달 */}
                {pickerDate && (
                    <RoomPickerModal
                        date={pickerDate}
                        selected={getRoomsForDate(pickerDate).filter(
                            (r) => !getOccupiedRoomsForDate(pickerDate).includes(r),
                        )}
                        occupiedRooms={getOccupiedRoomsForDate(pickerDate)}
                        disabledRooms={disabledRooms}
                        onConfirm={(rooms) => handleRoomConfirm(pickerDate, rooms)}
                        onClose={() => setPickerDate(null)}
                    />
                )}

                {/* 일괄 호실 지정 모달 */}
                {bulkRoomPickerOpen && (
                    <RoomPickerModal
                        date="전체 날짜"
                        selected={getRoomsForDate(getRoomDateRange()[0] ?? '')}
                        occupiedRooms={[]}
                        disabledRooms={disabledRooms}
                        onConfirm={applyBulkRooms}
                        onClose={() => setBulkRoomPickerOpen(false)}
                    />
                )}
            </div>
        </>
    );
}
