package com.heungkuk.academy.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // Account
    ACCOUNT_NOT_FOUND("존재하지 않는 계정입니다.", HttpStatus.NOT_FOUND),
    DUPLICATE_USER_ID("이미 사용 중인 아이디입니다.", HttpStatus.CONFLICT),
    // 로그인 실패 — 없는 계정 / 비밀번호 불일치를 구분하지 않음 (계정 존재 여부 노출 방지)
    LOGIN_FAILED("아이디 또는 비밀번호가 올바르지 않습니다.", HttpStatus.UNAUTHORIZED),

    // Reservation
    RESERVATION_NOT_FOUND("존재하지 않는 예약입니다.", HttpStatus.NOT_FOUND),

    // Room
    ROOM_NOT_FOUND("존재하지 않는 객실입니다.", HttpStatus.NOT_FOUND),
    ROOM_NOT_AVAILABLE("해당 날짜에 사용 불가능한 객실입니다.", HttpStatus.CONFLICT),
    ROOM_INSUFFICIENT("요청한 객실 수가 부족합니다.", HttpStatus.CONFLICT),

    // Lecture Room
    LECTURE_ROOM_NOT_FOUND("존재하지 않는 강의실입니다.", HttpStatus.NOT_FOUND),
    LECTURE_ROOM_NOT_AVAILABLE("해당 날짜/시간에 사용 불가능한 강의실입니다.", HttpStatus.CONFLICT),

    // Auth
    UNAUTHORIZED("인증이 필요합니다.", HttpStatus.UNAUTHORIZED),
    ACCESS_DENIED("접근 권한이 없습니다.", HttpStatus.FORBIDDEN),

    //Token
    INVALID_REFRESH_TOKEN("유효하지 않은 리프레시 토큰입니다.", HttpStatus.UNAUTHORIZED),

    // Survey
    SURVEY_TOKEN_NOT_FOUND("존재하지 않는 설문 토큰입니다.", HttpStatus.NOT_FOUND),
    SURVEY_ALREADY_SUBMITTED("이미 제출된 설문입니다.", HttpStatus.CONFLICT);


    private final String message;
    private final HttpStatus status;
}
