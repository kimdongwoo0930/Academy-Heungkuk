package com.heungkuk.academy.global.security.dto;

/**
 * AuthService → AuthController 로 넘기는 발급 토큰 묶음 (응답 DTO 아님)
 * 서비스는 토큰만 만들고, access 는 바디 / refresh 는 쿠키로 내보내는 건 컨트롤러가 담당한다.
 */
public record AuthTokens(String accessToken, String refreshToken) {
}
