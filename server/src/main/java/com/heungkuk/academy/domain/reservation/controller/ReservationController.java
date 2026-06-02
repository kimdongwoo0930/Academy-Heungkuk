package com.heungkuk.academy.domain.reservation.controller;

import java.time.LocalDate;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.heungkuk.academy.domain.reservation.dto.request.ReservationRequest;
import com.heungkuk.academy.domain.reservation.dto.response.ReservationResponse;
import com.heungkuk.academy.domain.reservation.service.ReservationService;
import com.heungkuk.academy.global.response.CommonResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;


@Tag(name = "예약 관리", description = "예약 등록 / 조회 / 수정 / 삭제 API (관리자 전용)")
@SecurityRequirement(name = "Bearer")
@RestController
@RequestMapping("/v1/admin/reservations")
@Slf4j
@RequiredArgsConstructor
public class ReservationController {

        private final ReservationService reservationService;

        // ── 등록 ──────────────────────────────────────────────────────────────

        @Operation(summary = "예약 등록", description = "객실, 강의실, 식사 정보를 함께 등록합니다.")
        @PostMapping
        public ResponseEntity<CommonResponse<ReservationResponse>> createReservation(
                        @RequestBody @Valid ReservationRequest request) {
                return ResponseEntity.status(201).body(CommonResponse
                                .success(reservationService.createReservation(request)));
        }

        // ── 조회 ──────────────────────────────────────────────────────────────

        /** 일정 현황 / 숙박 현황용 — 연도별 전체 조회 (페이징 없음) */
        @Operation(summary = "연도별 예약 조회", description = "해당 연도에 속하는 예약 전체를 반환합니다.")
        @GetMapping
        public ResponseEntity<CommonResponse<List<ReservationResponse>>> getReservationsByYear(
                        @Parameter(description = "조회 연도",
                                        example = "2026") @RequestParam int year) {
                return ResponseEntity.ok(CommonResponse
                                .success(reservationService.getReservationsByYear(year)));
        }

        /** 일정현황 3개월 뷰용 — 날짜 범위 조회 */
        @Operation(summary = "날짜 범위 예약 조회", description = "from ~ to 범위에 걸치는 예약 전체를 반환합니다.")
        @GetMapping("/range")
        public ResponseEntity<CommonResponse<List<ReservationResponse>>> getReservationsByRange(
                        @Parameter(description = "시작일 (yyyy-MM-dd)") @RequestParam @DateTimeFormat(
                                        iso = DateTimeFormat.ISO.DATE) LocalDate from,
                        @Parameter(description = "종료일 (yyyy-MM-dd)") @RequestParam @DateTimeFormat(
                                        iso = DateTimeFormat.ISO.DATE) LocalDate to) {
                return ResponseEntity.ok(CommonResponse
                                .success(reservationService.getReservationsByDateRange(from, to)));
        }

        /** 예약 관리 리스트용 — 키워드 + 상태 + 날짜 범위 + 페이징 */
        @Operation(summary = "예약 검색", description = "키워드(단체명·담당자·연락처·예약코드), 상태, 날짜 범위로 필터링하여 페이지 단위로 반환합니다.")
        @GetMapping("/search")
        public ResponseEntity<CommonResponse<Page<ReservationResponse>>> searchReservations(
                        @Parameter(description = "검색어 (단체명/담당자명/연락처/예약코드)") @RequestParam(
                                        required = false) String keyword,
                        @Parameter(description = "예약 상태 (확정/예약/문의/취소)") @RequestParam(
                                        required = false) String status,
                        @Parameter(description = "시작일 (yyyy-MM-dd)") @RequestParam(
                                        required = false) @DateTimeFormat(
                                                        iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
                        @Parameter(description = "종료일 (yyyy-MM-dd)") @RequestParam(
                                        required = false) @DateTimeFormat(
                                                        iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
                        @PageableDefault(size = 20, sort = "createdAt",
                                        direction = Sort.Direction.DESC) Pageable pageable) {
                return ResponseEntity
                                .ok(CommonResponse.success(reservationService.searchReservations(
                                                keyword, status, startDate, endDate, pageable)));
        }

        @Operation(summary = "예약 단건 조회")
        @GetMapping("/{id}")
        public ResponseEntity<CommonResponse<ReservationResponse>> getReservation(
                        @Parameter(description = "예약 ID", example = "1") @PathVariable Long id) {
                return ResponseEntity
                                .ok(CommonResponse.success(reservationService.getReservation(id)));
        }

        // ── 수정 ──────────────────────────────────────────────────────────────

        @Operation(summary = "예약 수정", description = "기존 객실/강의실/식사 정보는 삭제 후 재등록됩니다.")
        @PutMapping("/{id}")
        public ResponseEntity<CommonResponse<ReservationResponse>> updateReservation(
                        @Parameter(description = "예약 ID", example = "1") @PathVariable Long id,
                        @RequestBody @Valid ReservationRequest request) {
                return ResponseEntity.ok(CommonResponse
                                .success(reservationService.updateReservation(id, request)));
        }

        // ── 삭제 ──────────────────────────────────────────────────────────────

        @Operation(summary = "예약 취소", description = "상태를 '취소'로 변경합니다. (소프트 삭제)")
        @DeleteMapping("/{id}")
        public ResponseEntity<Void> deleteReservation(
                        @Parameter(description = "예약 ID", example = "1") @PathVariable Long id) {
                reservationService.deleteReservation(id);
                return ResponseEntity.status(204).build();
        }

        @Operation(summary = "예약 영구 삭제", description = "하위 데이터(강의실/객실/식사)까지 DB에서 완전 삭제합니다.")
        @DeleteMapping("/{id}/hard")
        public ResponseEntity<Void> hardDeleteReservation(
                        @Parameter(description = "예약 ID", example = "1") @PathVariable Long id) {
                reservationService.hardDeleteReservation(id);
                return ResponseEntity.status(204).build();
        }

        // ── 유틸 ──────────────────────────────────────────────────────────────

        @Operation(summary = "강의실 가용 여부 확인", description = "특정 날짜에 강의실이 사용 가능한지 확인합니다.")
        @GetMapping("/check-classroom")
        public ResponseEntity<CommonResponse<Boolean>> checkClassroom(
                        @Parameter(description = "강의실명",
                                        example = "105") @RequestParam String classroom,
                        @Parameter(description = "날짜 (yyyy-MM-dd)",
                                        example = "2026-04-01") @RequestParam @DateTimeFormat(
                                                        iso = DateTimeFormat.ISO.DATE) LocalDate date) {
                return ResponseEntity.ok(CommonResponse
                                .success(reservationService.checkClassroom(classroom, date)));
        }
}
