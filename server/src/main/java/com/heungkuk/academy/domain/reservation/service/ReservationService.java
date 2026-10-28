package com.heungkuk.academy.domain.reservation.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import com.heungkuk.academy.domain.reservation.dto.request.ReservationRequest;
import com.heungkuk.academy.domain.reservation.dto.response.ReservationResponse;

/** 예약 CRUD 및 조회 기능 인터페이스 */
public interface ReservationService {

    /** 예약 등록 (강의실·객실·식사 포함) */
    ReservationResponse createReservation(ReservationRequest request,String  userId);

    /** 특정 날짜에 해당 강의실 사용 가능 여부 확인 */
    boolean checkClassroom(String classroom, LocalDate date);

    /** 해당 연도 전체 예약 조회 — 연도별 현황표용 */
    List<ReservationResponse> getReservationsByYear(int year);

    /** 날짜 범위(from ~ to)에 걸치는 예약 조회 — 일정현황 3개월 뷰용 */
    List<ReservationResponse> getReservationsByDateRange(LocalDate from, LocalDate to);

    /** 키워드·상태·날짜 범위 필터 + 페이징 — 예약 관리 리스트용 */
    Page<ReservationResponse> searchReservations(String keyword, String status, LocalDate startDate,
            LocalDate endDate, Pageable pageable);

    /** 예약 단건 조회 */
    ReservationResponse getReservation(Long id);

    /** 예약 취소 (상태를 '취소'로 변경, 소프트 삭제) */
    void deleteReservation(Long id, String userId);

    /** 예약 영구 삭제 (하위 데이터 포함 DB에서 완전 제거) */
    void hardDeleteReservation(Long id, String userId);

    /** 예약 수정 (기존 강의실·객실·식사 삭제 후 재등록) */
    ReservationResponse updateReservation(Long id, ReservationRequest request, String userId);
}
