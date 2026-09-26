package com.heungkuk.academy.domain.account.entity;

import java.time.LocalDateTime;
import com.heungkuk.academy.global.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 로그인 세션(기기)별 refresh 토큰 — 로그인 1회 = 1행
 * PC / 아이패드처럼 여러 기기에서 동시에 로그인해도 서로의 세션을 덮어쓰지 않는다.
 * created_at = 로그인 시각, updated_at = 마지막 재발급 시각
 */
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
@Entity
@Table(name = "refresh_token")
public class RefreshToken extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    // 로그인 시 생성하는 세션 ID(UUID) — refresh 토큰의 sid 클레임, rotation 해도 유지
    @Column(name = "session_id", length = 36, nullable = false, unique = true)
    private String sessionId;

    // 현재 유효한 refresh 토큰의 SHA-256 해시 (원문은 저장하지 않음)
    @Column(name = "token_hash", length = 64, nullable = false)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;


    public static RefreshToken of(Account account, String sessionId, String tokenHash,
            LocalDateTime expiresAt) {
        return RefreshToken.builder().account(account).sessionId(sessionId).tokenHash(tokenHash)
                .expiresAt(expiresAt).build();
    }

    // 재발급 시 새 토큰으로 교체 → 이전 refresh 토큰은 더 이상 쓸 수 없음
    public void rotate(String newTokenHash, LocalDateTime newExpiresAt) {
        this.tokenHash = newTokenHash;
        this.expiresAt = newExpiresAt;
    }
}
