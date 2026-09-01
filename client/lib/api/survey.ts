import instance from './instance';
import axios from 'axios';
import { PageResult } from '@/types/reservation';
import { SurveyTokenResponse, SurveyResult, SurveyAnswers } from '@/types/survey';

export async function createSurveyToken(reservationId: string): Promise<SurveyTokenResponse> {
  const res = await instance.post(`/v1/admin/surveys/token/${reservationId}`);
  return res.data.data;
}

export async function getAllSurveyTokens(): Promise<SurveyTokenResponse[]> {
  const res = await instance.get('/v1/admin/surveys/tokens');
  return res.data.data;
}

export async function getAllSurveys(): Promise<SurveyResult[]> {
  const res = await instance.get('/v1/admin/surveys');
  return res.data.data;
}

/** 설문 결과 리스트 — 검색 + 페이징 (설문 관리 화면 하단 목록용) */
export async function getSurveyPage(params: {
  keyword?: string;
  page?: number;
  size?: number;
}): Promise<PageResult<SurveyResult>> {
  const res = await instance.get('/v1/admin/surveys/search', { params });
  return res.data.data;
}

export async function getSurveyToken(reservationId: string): Promise<SurveyTokenResponse | null> {
  try {
    const res = await instance.get(`/v1/admin/surveys/token/${reservationId}`);
    return res.data.data;
  } catch {
    return null;
  }
}

export async function getSurveys(reservationId: string): Promise<SurveyResult[]> {
  const res = await instance.get(`/v1/admin/surveys/${reservationId}`);
  return res.data.data;
}

export async function checkSurveyToken(token: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  const res = await axios.get(`${baseUrl}/v1/survey/check/${token}`);
  return res.data.data; // true = 이미 사용됨
}

export async function submitSurvey(token: string, answers: SurveyAnswers): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  await axios.post(`${baseUrl}/v1/survey/${token}`, answers);
}
