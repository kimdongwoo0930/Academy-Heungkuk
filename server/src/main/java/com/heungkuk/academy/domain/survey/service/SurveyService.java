package com.heungkuk.academy.domain.survey.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.heungkuk.academy.domain.survey.dto.request.SurveyRequest;
import com.heungkuk.academy.domain.survey.dto.response.SurveyResponse;
import com.heungkuk.academy.domain.survey.dto.response.SurveyTokenResponse;

/** 설문 URL 생성·응답 제출·결과 조회 기능 인터페이스 */
public interface SurveyService {

    /** 설문 URL 생성 (UUID 토큰 발급, 관리자용) */
    SurveyTokenResponse createUrl(String reservationId);

    /** 설문 응답 제출 (고객용, 인증 불필요) */
    void saveSurvey(String token, SurveyRequest surveyRequest);

    /** 특정 예약의 설문 응답 목록 조회 */
    List<SurveyResponse> getSurveys(String reservationId);

    /** 특정 예약의 설문 토큰 조회 */
    SurveyTokenResponse getToken(String reservationId);

    /** 전체 설문 응답 목록 조회 (최신순) */
    List<SurveyResponse> getSurveyList();

    /** 전체 설문 토큰 목록 조회 */
    List<SurveyTokenResponse> getAllTokens();

    /** 설문 토큰 사용 여부 확인 (고객용, 인증 불필요) */
    boolean isTokenUsed(String token);

    /** 설문 검색및 목록 조회(페이징) */
    Page<SurveyResponse> getSurveyPage(String keyword, Pageable pageable);
}
