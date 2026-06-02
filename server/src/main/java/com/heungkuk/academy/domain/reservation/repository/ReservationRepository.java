package com.heungkuk.academy.domain.reservation.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.heungkuk.academy.domain.reservation.entity.Reservation;

public interface ReservationRepository extends JpaRepository<Reservation, Long> {

  Optional<Reservation> findByReservationCode(String reservationCode);

  @Query(
      value = "SELECT COUNT(*) FROM reservation WHERE reservation_code LIKE CONCAT(:prefix, '%')",
      nativeQuery = true)
  int countByCodePrefix(@Param("prefix") String prefix);

  @Query("SELECT r FROM Reservation r WHERE r.startDate <= :endOfYear AND r.endDate >= :startOfYear")
  List<Reservation> findByDateRange(@Param("startOfYear") LocalDate startOfYear,
      @Param("endOfYear") LocalDate endOfYear);

  @Query(value = """
      SELECT r FROM Reservation r
      WHERE (:keyword IS NULL
          OR r.organization LIKE %:keyword%
          OR r.customer LIKE %:keyword%
          OR r.reservationCode LIKE %:keyword%
          OR r.customerPhone LIKE %:keyword%
          OR r.customerPhone2 LIKE %:keyword%
          OR r.siteManagerPhone LIKE %:keyword%
          OR r.siteManagerPhone2 LIKE %:keyword%
          OR r.billingManagerPhone LIKE %:keyword%
          OR REPLACE(r.customerPhone, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.customerPhone2, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.siteManagerPhone, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.siteManagerPhone2, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.billingManagerPhone, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%'))
        AND (:status IS NULL OR r.status = :status)
        AND (:startDate IS NULL OR r.startDate >= :startDate)
        AND (:endDate IS NULL OR r.endDate <= :endDate)
      """, countQuery = """
      SELECT COUNT(r) FROM Reservation r
      WHERE (:keyword IS NULL
          OR r.organization LIKE %:keyword%
          OR r.customer LIKE %:keyword%
          OR r.reservationCode LIKE %:keyword%
          OR r.customerPhone LIKE %:keyword%
          OR r.customerPhone2 LIKE %:keyword%
          OR r.siteManagerPhone LIKE %:keyword%
          OR r.siteManagerPhone2 LIKE %:keyword%
          OR r.billingManagerPhone LIKE %:keyword%
          OR REPLACE(r.customerPhone, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.customerPhone2, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.siteManagerPhone, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.siteManagerPhone2, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%')
          OR REPLACE(r.billingManagerPhone, '-', '') LIKE CONCAT('%', REPLACE(:keyword, '-', ''), '%'))
        AND (:status IS NULL OR r.status = :status)
        AND (:startDate IS NULL OR r.startDate >= :startDate)
        AND (:endDate IS NULL OR r.endDate <= :endDate)
      """)
  Page<Reservation> search(@Param("keyword") String keyword, @Param("status") String status,
      @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate,
      Pageable pageable);

  // ── 대시보드 ───────────────────────────────────────────────────────

  @Query("SELECT COUNT(DISTINCT r.organization) FROM Reservation r WHERE YEAR(r.startDate) = :year AND MONTH(r.startDate) = :month AND r.status != '취소'")
  long countByYearMonth(@Param("year") int year, @Param("month") int month);

  @Query("SELECT r FROM Reservation r WHERE r.startDate = :today AND r.status != '취소'")
  List<Reservation> findTodayCheckIns(@Param("today") LocalDate today);

  @Query("SELECT SUM(r.people) FROM Reservation r WHERE r.startDate = :today AND r.status != '취소'")
  Long sumPeopleForToday(@Param("today") LocalDate today);


  @Query("SELECT MONTH(r.startDate) as month, COUNT(DISTINCT r.organization) as cnt FROM Reservation r WHERE YEAR(r.startDate) = :year AND r.status != '취소' GROUP BY MONTH(r.startDate)")
  List<Object[]> countByMonthInYear(@Param("year") int year);

}
