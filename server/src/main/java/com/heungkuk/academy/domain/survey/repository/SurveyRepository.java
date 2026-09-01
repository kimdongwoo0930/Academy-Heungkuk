package com.heungkuk.academy.domain.survey.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.heungkuk.academy.domain.survey.entity.Survey;
import com.heungkuk.academy.domain.survey.entity.SurveyToken;


public interface SurveyRepository extends JpaRepository<Survey, Long> {
    List<Survey> findBySurveyToken(SurveyToken surveyToken);

    List<Survey> findAllByOrderByCreatedAtDesc();

    List<Survey> findTop5ByOrderByCreatedAtDesc();

    @Query("""
            SELECT s FROM Survey s
            JOIN s.surveyToken t
            JOIN Reservation r ON r.reservationCode = t.reservationId
            WHERE r.status != '취소'
            ORDER BY s.createdAt DESC
            """)
    List<Survey> findRecentActiveReservationSurveys(Pageable pageable);

    @Query("""
            SELECT AVG(s.staffService) as staffService,
                   AVG(s.cleanliness)  as cleanliness,
                   AVG(s.facilities)   as facilities,
                   AVG(s.cafeteria)    as cafeteria,
                   AVG(s.pricing)      as pricing,
                   COUNT(s)            as total
            FROM Survey s
            JOIN s.surveyToken t
            JOIN Reservation r ON r.reservationCode = t.reservationId
            WHERE r.status != '취소'
            """)
    SatisfactionStats getSatisfactionStats();

    @Query(value = """
            SELECT s FROM Survey s
            JOIN s.surveyToken t
            LEFT JOIN Reservation r ON r.reservationCode = t.reservationId
            WHERE (:keyword IS NULL
                OR r.organization LIKE %:keyword%
                OR r.customer LIKE %:keyword%
                OR t.reservationId LIKE %:keyword%)
            """, countQuery = """
            SELECT COUNT(s) FROM Survey s
            JOIN s.surveyToken t
            LEFT JOIN Reservation r ON r.reservationCode = t.reservationId
            WHERE (:keyword IS NULL
                OR r.organization LIKE %:keyword%
                OR r.customer LIKE %:keyword%
                OR t.reservationId LIKE %:keyword%)
            """)
    Page<Survey> searchSurveys(@Param("keyword") String keyword, Pageable pageable);

    interface SatisfactionStats {
        Double getStaffService();
        Double getCleanliness();
        Double getFacilities();
        Double getCafeteria();
        Double getPricing();
        Long getTotal();
    }
}
