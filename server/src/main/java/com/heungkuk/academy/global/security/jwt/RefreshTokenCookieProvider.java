package com.heungkuk.academy.global.security.jwt;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * refresh 토큰 쿠키 생성/만료를 한 곳에서 관리
 * 로그인·재발급(create)과 로그아웃(expire)이 같은 이름·Path 를 써야 브라우저가 같은 쿠키로 인식한다.
 */
@Component
public class RefreshTokenCookieProvider {

    public static final String COOKIE_NAME = "refreshToken";
    // reissue / logout 요청에만 쿠키가 실리도록 범위를 좁힌다
    private static final String COOKIE_PATH = "/v1/auth";

    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration;

    // 운영(https)은 true, 로컬(http://localhost)은 false
    @Value("${app.auth.cookie-secure}")
    private boolean cookieSecure;

    public ResponseCookie create(String refreshToken) {
        return build(refreshToken, Duration.ofMillis(refreshExpiration));
    }

    public ResponseCookie expire() {
        return build("", Duration.ZERO);
    }

    private ResponseCookie build(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE_NAME, value)
                .httpOnly(true)          // JS(document.cookie)에서 읽을 수 없음 → XSS 로 탈취 불가
                .secure(cookieSecure)    // true 면 HTTPS 에서만 전송
                .sameSite("Strict")      // 다른 사이트에서 시작된 요청에는 전송 안 함 (CSRF 차단)
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
