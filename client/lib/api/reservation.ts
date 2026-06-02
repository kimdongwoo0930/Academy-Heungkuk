import instance from './instance';
import {
  Reservation,
  PageResult,
  ImportResult,
  ReservationRequestBody,
} from '@/types/reservation';

export type { PageResult, ImportResult, ReservationRequestBody };

export function toRequestBody(data: Omit<Reservation, 'id' | 'reservationCode'>): ReservationRequestBody {
  return {
    organization: data.organization,
    purpose: data.purpose,
    people: data.people,
    customer: data.customer,
    customerPhone: data.customerPhone,
    customerPhone2: data.customerPhone2,
    customerEmail: data.customerEmail,
    startDate: data.startDate,
    endDate: data.endDate,
    colorCode: data.colorCode,
    status: data.status,
    companyZipCode: data.companyZipCode,
    companyAddress: data.companyAddress,
    businessNumber: data.businessNumber,
    ceoName: data.ceoName,
    siteManager: data.siteManager,
    siteManagerPhone: data.siteManagerPhone,
    siteManagerPhone2: data.siteManagerPhone2,
    siteManagerEmail: data.siteManagerEmail,
    billingManager: data.billingManager,
    billingManagerPhone: data.billingManagerPhone,
    billingManagerEmail: data.billingManagerEmail,
    paymentMethod: data.paymentMethod,
    memo: data.memo,
    classrooms: (data.classrooms ?? []).map((c) => ({
      classroomName: c.classroomName,
      reservedDate: c.reservedDate,
    })),
    rooms: (data.rooms ?? []).map((r) => ({
      roomNumber: r.roomNumber,
      reservedDate: r.reservedDate,
    })),
    meals: (data.meals ?? []).map((m) => ({
      reservedDate: m.reservedDate,
      breakfast: m.breakfast,
      lunch: m.lunch,
      dinner: m.dinner,
      specialBreakfast: m.specialBreakfast ?? false,
      specialLunch: m.specialLunch ?? false,
      specialDinner: m.specialDinner ?? false,
    })),
  };
}

export async function getReservations(): Promise<Reservation[]> {
  const res = await instance.get('/v1/admin/reservations');
  return res.data.data;
}

export async function getReservationsByYear(year: number): Promise<Reservation[]> {
  const res = await instance.get('/v1/admin/reservations', { params: { year } });
  return res.data.data;
}

export async function getReservationsByRange(from: string, to: string): Promise<Reservation[]> {
  const res = await instance.get('/v1/admin/reservations/range', { params: { from, to } });
  return res.data.data;
}

export async function searchReservations(params: {
  keyword?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
  sort?: string;
}): Promise<PageResult<Reservation>> {
  const res = await instance.get('/v1/admin/reservations/search', { params });
  return res.data.data;
}

export async function getReservationById(id: number): Promise<Reservation> {
  const res = await instance.get(`/v1/admin/reservations/${id}`);
  return res.data.data;
}

export async function createReservation(body: ReservationRequestBody): Promise<Reservation> {
  const res = await instance.post('/v1/admin/reservations', body);
  return res.data.data;
}

export async function updateReservation(id: number, body: ReservationRequestBody): Promise<Reservation> {
  const res = await instance.put(`/v1/admin/reservations/${id}`, body);
  return res.data.data;
}

export async function deleteReservation(id: number): Promise<void> {
  await instance.delete(`/v1/admin/reservations/${id}`);
}

export async function hardDeleteReservation(id: number): Promise<void> {
  await instance.delete(`/v1/admin/reservations/${id}/hard`);
}

/**
 * xlsx 파일을 서버로 업로드하여 예약 데이터를 일괄 등록/수정
 * FormData에 파일을 담아 multipart/form-data 로 전송
 */
export async function importReservations(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await instance.post<{ data: ImportResult }>('/v1/admin/reservations/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

/** Blob 응답을 파일로 다운로드하는 공통 헬퍼 */
async function downloadBlob(endpoint: string, filename: string): Promise<void> {
  const res = await instance.get(endpoint, { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatIssueDate(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  }).format(new Date());
}

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '').trim();
}

function buildDocumentFilename(documentName: string, id: number, org?: string): string {
  const organization = org ? sanitizeFilenamePart(org) : String(id);
  return `흥국생명용인연수원_${documentName}_${organization}(${formatIssueDate()}).xlsx`;
}

export async function downloadTrade(id: number, org?: string): Promise<void> {
  await downloadBlob(
    `/v1/admin/reservations/${id}/trade`,
    buildDocumentFilename('거래명세서', id, org),
  );
}

export async function downloadEstimate(id: number, org?: string): Promise<void> {
  await downloadBlob(
    `/v1/admin/reservations/${id}/estimate`,
    buildDocumentFilename('견적서', id, org),
  );
}

export async function downloadConfirmation(id: number, org?: string): Promise<void> {
  await downloadBlob(
    `/v1/admin/reservations/${id}/confirmation`,
    buildDocumentFilename('확인서', id, org),
  );
}

export async function exportReservations(): Promise<void> {
  await downloadBlob(
    '/v1/admin/reservations/export',
    `reservations_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
