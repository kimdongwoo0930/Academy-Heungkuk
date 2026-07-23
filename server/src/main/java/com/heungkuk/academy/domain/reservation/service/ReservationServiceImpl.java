package com.heungkuk.academy.domain.reservation.service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.heungkuk.academy.domain.reservation.dto.request.ReservationRequest;
import com.heungkuk.academy.domain.reservation.dto.response.ClassroomReservationResponse;
import com.heungkuk.academy.domain.reservation.dto.response.MealReservationResponse;
import com.heungkuk.academy.domain.reservation.dto.response.ReservationResponse;
import com.heungkuk.academy.domain.reservation.dto.response.RoomReservationResponse;
import com.heungkuk.academy.domain.reservation.entity.ClassroomReservation;
import com.heungkuk.academy.domain.reservation.entity.MealReservation;
import com.heungkuk.academy.domain.reservation.entity.Reservation;
import com.heungkuk.academy.domain.reservation.entity.RoomReservation;
import com.heungkuk.academy.domain.reservation.repository.ClassroomReservationRepository;
import com.heungkuk.academy.domain.reservation.repository.MealReservationRepository;
import com.heungkuk.academy.domain.reservation.repository.ReservationRepository;
import com.heungkuk.academy.domain.reservation.repository.RoomReservationRepository;
import com.heungkuk.academy.global.exception.BusinessException;
import com.heungkuk.academy.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReservationServiceImpl implements ReservationService {

        private final ReservationRepository reservationRepository;
        private final ClassroomReservationRepository classroomReservationRepository;
        private final MealReservationRepository mealReservationRepository;
        private final RoomReservationRepository roomReservationRepository;

        /**
         * 예약 등록 예약 코드 생성 → Reservation 저장 → 객실/강의실/식사 예약 순으로 처리
         */
        @Override
        @Transactional
        public ReservationResponse createReservation(ReservationRequest request) {

                // 1. 예약 코드 생성 (HK-20260316-001)
                String reservationCode = generateReservationCode(request.getStartDate());

                // 2. Reservation 엔티티 생성 후 저장
                Reservation reservation = reservationRepository
                                .save(Reservation.from(request, reservationCode));

                // 3. 객실 예약 저장
                saveRooms(reservation, request);

                // 4. 강의실 예약 저장
                saveClassrooms(reservation, request);

                // 5. 식사 예약 저장
                saveMeals(reservation, request);

                log.info("예약 생성: code={}, organization={}, period={} ~ {}", reservationCode,
                                request.getOrganization(), request.getStartDate(),
                                request.getEndDate());
                return toResponse(reservation);
        }

        /** 강의실 중복 체크 (true = 사용 가능, false = 중복) */
        @Override
        public boolean checkClassroom(String classroom, LocalDate date) {
                return !classroomReservationRepository.existsConflict(classroom, date);
        }

        /** 연도별 전체 조회 — 일정/숙박 현황표용 */
        @Override
        public List<ReservationResponse> getReservationsByYear(int year) {
                return toResponseList(reservationRepository.findByDateRange(
                                LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31)));

        }

        /** 날짜 범위 조회 — 일정현황 3개월 뷰용 */
        @Override
        public List<ReservationResponse> getReservationsByDateRange(LocalDate from, LocalDate to) {
                return toResponseList(reservationRepository.findByDateRange(from, to));
        }

        /** 검색 + 필터 + 페이징 — 예약 관리 리스트용 */
        @Override
        public Page<ReservationResponse> searchReservations(String keyword, String status,
                        LocalDate startDate, LocalDate endDate, Pageable pageable) {

                Page<Reservation> page = reservationRepository.search(keyword, status, startDate,
                                endDate, pageable);
                List<ReservationResponse> responseList = toResponseList(page.getContent());
                return new PageImpl<>(responseList, pageable, page.getTotalElements());

        }

        /** 예약 단건 조회 */
        @Override
        public ReservationResponse getReservation(Long id) {
                Reservation reservation = reservationRepository.findById(id).orElseThrow(
                                () -> new BusinessException(ErrorCode.RESERVATION_NOT_FOUND));
                return toResponse(reservation);
        }

        /**
         * 예약 취소 (완전 삭제 X, status를 "취소"로 변경) 이력 보존을 위해 소프트 딜리트 방식 사용
         */
        @Override
        @Transactional
        public void deleteReservation(Long id) {
                Reservation reservation = reservationRepository.findById(id).orElseThrow(
                                () -> new BusinessException(ErrorCode.RESERVATION_NOT_FOUND));
                reservation.updateStatus("취소");
                log.info("예약 취소: id={}, code={}, organization={}", id,
                                reservation.getReservationCode(), reservation.getOrganization());
        }

        /**
         * 예약 완전 삭제 (하위 데이터 포함 DB에서 영구 제거)
         */
        @Override
        @Transactional
        public void hardDeleteReservation(Long id) {
                Reservation reservation = reservationRepository.findById(id).orElseThrow(
                                () -> new BusinessException(ErrorCode.RESERVATION_NOT_FOUND));
                roomReservationRepository.deleteByReservation(reservation);
                classroomReservationRepository.deleteByReservation(reservation);
                mealReservationRepository.deleteByReservation(reservation);
                reservationRepository.delete(reservation);
                log.info("예약 영구 삭제: id={}, code={}, organization={}", id,
                                reservation.getReservationCode(), reservation.getOrganization());
        }

        /**
         * 예약 수정 기존 객실/강의실/식사 예약을 전부 삭제 후 새로 저장 (단순 재생성 방식)
         */
        @Override
        @Transactional
        public ReservationResponse updateReservation(Long id, ReservationRequest request) {
                Reservation reservation = reservationRepository.findById(id).orElseThrow(
                                () -> new BusinessException(ErrorCode.RESERVATION_NOT_FOUND));

                // 기존 하위 예약 전부 삭제
                roomReservationRepository.deleteByReservation(reservation);
                classroomReservationRepository.deleteByReservation(reservation);
                mealReservationRepository.deleteByReservation(reservation);

                // 새 데이터로 다시 저장
                saveRooms(reservation, request);
                saveClassrooms(reservation, request);
                saveMeals(reservation, request);

                reservation.update(request);
                log.info("예약 수정: id={}, code={}, organization={}", id,
                                reservation.getReservationCode(), request.getOrganization());
                return toResponse(reservation);
        }

        /**
         * 예약 코드 생성 형식: HK-yyyyMMdd-순번 (예: HK-20260316-001) 같은 날짜의 기존 예약 수를 조회해서 순번 결정
         */
        private String generateReservationCode(LocalDate date) {
                String dateStr = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
                int count = reservationRepository.countByCodePrefix("HK-" + dateStr);
                String seq = String.format("%03d", count + 1);
                return "HK-" + dateStr + "-" + seq;
        }

        private List<ReservationResponse> toResponseList(List<Reservation> reservations) {
                // 1. 3번 쿼리로 전부 가져옴
                List<RoomReservation> allRooms =
                                roomReservationRepository.findByReservationIn(reservations);
                List<ClassroomReservation> allClassrooms =
                                classroomReservationRepository.findByReservationIn(reservations);
                List<MealReservation> allMeals =
                                mealReservationRepository.findByReservationIn(reservations);

                // 2. 예약 ID 기준으로 Map으로 분류 (DB 아님, 메모리 작업)
                Map<Long, List<RoomReservation>> roomsMap = allRooms.stream()
                                .collect(Collectors.groupingBy(r -> r.getReservation().getId()));
                Map<Long, List<ClassroomReservation>> classroomsMap = allClassrooms.stream()
                                .collect(Collectors.groupingBy(c -> c.getReservation().getId()));
                Map<Long, List<MealReservation>> mealsMap = allMeals.stream()
                                .collect(Collectors.groupingBy(m -> m.getReservation().getId()));

                // 3. 각 예약에 맞는 데이터를 Map에서 꺼내서 Response 조립
                return reservations.stream().map(r -> ReservationResponse.of(r,
                                roomsMap.getOrDefault(r.getId(), List.of()).stream()
                                                .map(RoomReservationResponse::of).toList(),
                                classroomsMap.getOrDefault(r.getId(), List.of()).stream()
                                                .map(ClassroomReservationResponse::of).toList(),
                                mealsMap.getOrDefault(r.getId(), List.of()).stream()
                                                .map(MealReservationResponse::of).toList()))
                                .toList();
        }


        /**
         * 응답 형식 생성 함수
         */
        private ReservationResponse toResponse(Reservation reservation) {
                List<RoomReservationResponse> rooms =
                                roomReservationRepository.findByReservation(reservation).stream()
                                                .map(RoomReservationResponse::of).toList();
                List<ClassroomReservationResponse> classrooms = classroomReservationRepository
                                .findByReservation(reservation).stream()
                                .map(ClassroomReservationResponse::of).toList();
                List<MealReservationResponse> meals =
                                mealReservationRepository.findByReservation(reservation).stream()
                                                .map(MealReservationResponse::of).toList();
                return ReservationResponse.of(reservation, rooms, classrooms, meals);
        }

        /**
         * 예약 객실을 한번에 저장하는 함수
         */
        private void saveRooms(Reservation reservation, ReservationRequest request) {
                if (request.getRooms() == null || request.getRooms().isEmpty())
                        return;

                List<RoomReservation> roomReservations =
                                request.getRooms().stream().map(r -> RoomReservation.of(reservation,
                                                r.getRoomNumber(), r.getReservedDate())).toList();

                roomReservationRepository.saveAll(roomReservations);
        }
        /**
         * 예약 강의실을 한번에 저장하는 함수
         */
        private void saveClassrooms(Reservation reservation, ReservationRequest request) {
                if (request.getClassrooms() == null || request.getClassrooms().isEmpty())
                        return;

                List<ClassroomReservation> classroomReservations = request.getClassrooms().stream()
                                .map(cr -> ClassroomReservation.of(reservation, cr)).toList();
                classroomReservationRepository.saveAll(classroomReservations);
        }

        /**
         * 예약 식수를 한번에 저장하는 함수
         */
        private void saveMeals(Reservation reservation, ReservationRequest request) {
                if (request.getMeals() != null && !request.getMeals().isEmpty()) {
                        List<MealReservation> mealReservations = request.getMeals().stream()
                                        .map(cr -> MealReservation.of(reservation, cr)).toList();

                        mealReservationRepository.saveAll(mealReservations);
                }
        }

}
