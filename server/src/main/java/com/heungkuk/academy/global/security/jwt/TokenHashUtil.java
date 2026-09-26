package com.heungkuk.academy.global.security.jwt;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * refresh 토큰을 DB 에 원문 대신 SHA-256 해시로 저장/비교하기 위한 유틸
 *
 * - BCrypt 를 쓰지 않는 이유: 입력의 앞 72바이트만 사용해 JWT(앞부분이 거의 동일)에 부적합하고,
 *   토큰 자체가 추측 불가능한 긴 값이라 느린 해시가 필요 없다.
 * - SHA-256 은 같은 입력 → 같은 결과라 저장값과 바로 비교할 수 있다.
 */
public final class TokenHashUtil {

    private TokenHashUtil() {
    }

    /** 토큰의 SHA-256 해시 (64자 hex) */
    public static String sha256(String token) {
        return HexFormat.of().formatHex(digest(token));
    }

    /**
     * 요청으로 온 토큰이 저장된 해시와 일치하는지 확인
     * - 저장된 해시가 없으면(로그인 이력 없음 / 로그아웃 / 강제 로그아웃) false
     * - MessageDigest.isEqual: 끝까지 비교하는 상수 시간 비교 (응답 시간으로 일치 길이 추측 방지)
     */
    public static boolean matches(String rawToken, String savedHash) {
        if (rawToken == null || savedHash == null) {
            return false;
        }
        byte[] expected = savedHash.getBytes(StandardCharsets.UTF_8);
        byte[] actual = sha256(rawToken).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expected, actual);
    }

    private static byte[] digest(String token) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 은 모든 JVM 에서 필수 지원 알고리즘이라 발생하지 않음
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
