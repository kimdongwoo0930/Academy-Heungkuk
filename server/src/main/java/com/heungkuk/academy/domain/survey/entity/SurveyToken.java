package com.heungkuk.academy.domain.survey.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import com.heungkuk.academy.global.entity.BaseTimeEntity;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "survey_token")
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class SurveyToken extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Reservation.reservationCode(예약번호) 값. Reservation PK(id)가 아니며 FK 제약도 없음 */
    @Column(name = "reservation_id", nullable = false)
    private String reservationId;

    @Column(nullable = false, unique = true, length = 255)
    private String token;

    @Column(name = "is_used", nullable = false)
    private Boolean isUsed;


    public void updateIsUsed() {
        this.isUsed = true;
    }

    public static SurveyToken of(String reservationId, String token) {
        return SurveyToken.builder().reservationId(reservationId).token(token).isUsed(false)
                .build();

    }
}
