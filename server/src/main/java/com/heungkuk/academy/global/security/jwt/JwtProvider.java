package com.heungkuk.academy.global.security.jwt;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Component
public class JwtProvider {

    // 토큰 종류 — access 자리에 refresh 를 넣거나(또는 반대) 하는 혼용을 막기 위해 type 클레임으로 구분
    public static final String TOKEN_TYPE_ACCESS = "access";
    public static final String TOKEN_TYPE_REFRESH = "refresh";
    private static final String CLAIM_TYPE = "type";
    // refresh 토큰이 속한 로그인 세션(기기) ID — refresh_token 테이블의 session_id 와 매칭
    private static final String CLAIM_SESSION_ID = "sid";

    @Value("${jwt.secret}")
    private String secretKey;

    @Value("${jwt.access-expiration}")
    private long accessExpiration;

    @Value("${jwt.refresh-expiration}")
    private long refreshExpiration;

    // 1. generateAccessToken(Long userId)
    public String generateAccessToken(String userId, String role){
        return Jwts.builder()
            .subject(String.valueOf(userId))
            .claim("role", role)
            .claim(CLAIM_TYPE, TOKEN_TYPE_ACCESS)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + accessExpiration))
            .signWith(getSigningKey())
            .compact();
    }
    // 2. generateRefreshToken — 같은 세션(sid)으로 rotation 하면 기기별 세션이 유지된다
    //    jti(고유 ID): iat/exp 가 초 단위라 같은 초에 만들면 토큰이 완전히 같아져 rotation 이 무력화되므로 매번 다르게
    public String generateRefreshToken(String userId, String sessionId){
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(String.valueOf(userId))
            .claim(CLAIM_TYPE, TOKEN_TYPE_REFRESH)
            .claim(CLAIM_SESSION_ID, sessionId)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + refreshExpiration))
            .signWith(getSigningKey())
            .compact();
    }
    // 3. 토큰 검증 — 서명·만료 + 종류(type)까지 확인
    // (종류 확인 없는 범용 validateToken 은 혼용 위험이 있어 두지 않는다)
    public boolean isAccessToken(String token) {
        return hasType(token, TOKEN_TYPE_ACCESS);
    }

    public boolean isRefreshToken(String token) {
        return hasType(token, TOKEN_TYPE_REFRESH);
    }

    private boolean hasType(String token, String expectedType) {
        try {
            return expectedType.equals(parseClaims(token).get(CLAIM_TYPE, String.class));
        } catch (JwtException | IllegalArgumentException e) {
            // 서명 불일치, 만료, 형식 오류, null/빈 문자열
            return false;
        }
    }

    // 4. 클레임 조회 — isAccessToken / isRefreshToken 으로 검증한 뒤에 호출
    public String getUserId(String token){
        return parseClaims(token).getSubject();
    }

    public String getRole(String token){
        return parseClaims(token).get("role", String.class);
    }

    public String getSessionId(String token){
        return parseClaims(token).get(CLAIM_SESSION_ID, String.class);
    }

    public LocalDateTime getExpiration(String token){
        return LocalDateTime.ofInstant(parseClaims(token).getExpiration().toInstant(),
                ZoneId.systemDefault());
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
    }


}
