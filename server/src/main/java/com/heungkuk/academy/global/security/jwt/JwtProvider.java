package com.heungkuk.academy.global.security.jwt;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Slf4j
@Component
public class JwtProvider {

    // 토큰 종류 — access 자리에 refresh 를 넣거나(또는 반대) 하는 혼용을 막기 위해 type 클레임으로 구분
    public static final String TOKEN_TYPE_ACCESS = "access";
    public static final String TOKEN_TYPE_REFRESH = "refresh";
    private static final String CLAIM_TYPE = "type";

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
    // 2. generateRefreshToken(Long userId)
    public String generateRefreshToken(String userId){
        return Jwts.builder()
            .subject(String.valueOf(userId))
            .claim(CLAIM_TYPE, TOKEN_TYPE_REFRESH)
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
            String type = Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get(CLAIM_TYPE, String.class);
            return expectedType.equals(type);
        } catch (JwtException | IllegalArgumentException e) {
            // 서명 불일치, 만료, 형식 오류, null/빈 문자열
            return false;
        }
    }
    // 4. getuserId(String token)
    public String getUserId(String token){
        return 
            Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .getSubject();
    }

    public String getRole(String token){
        return Jwts.parser()
            .verifyWith(getSigningKey())
            .build()
            .parseSignedClaims(token)
            .getPayload()
            .get("role",String.class);
    }



    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secretKey.getBytes(StandardCharsets.UTF_8));
    }


}
