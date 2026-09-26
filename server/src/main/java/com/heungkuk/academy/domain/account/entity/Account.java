package com.heungkuk.academy.domain.account.entity;


import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.heungkuk.academy.domain.account.dto.request.SignupRequest;
import com.heungkuk.academy.global.entity.BaseTimeEntity;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "account")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Account extends BaseTimeEntity {

    // PK: id (BIGINT, AUTO_INCREMENT)
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // user_id: VARCHAR(50), UNIQUE, NOT NULL — 로그인 아이디
    @Column(name = "user_id", nullable = false, unique = true, length = 50)
    private String userId;

    // username: VARCHAR(50), NOT NULL — 직원 이름
    @Column(nullable = false, length = 50)
    private String username;

    // password: VARCHAR(255), NOT NULL — BCrypt 암호화
    @Column(nullable = false, length = 255)
    private String password;

    // role: VARCHAR(20), NOT NULL — "ROLE_ADMIN" / "ROLE_USER"
    @Column(nullable = false, length = 20)
    private String role;

    // state: BOOLEAN, NOT NULL — 관리자 승인 여부
    @Column(nullable = false)
    private Boolean state;

    // refresh 토큰 원문이 아닌 SHA-256 해시(64자 hex) — DB 유출 시에도 토큰으로 쓸 수 없게
    // 컬럼명은 기존 refresh_token 유지 (이름을 바꾸면 ddl-auto=update 가 옛 컬럼을 평문째 남겨둠)
    @Column(name = "refresh_token", length = 64)
    private String refreshTokenHash;

    // created_at, updated_at → BaseTimeEntity 가 자동 처리

    public static Account from(SignupRequest request, String encodedPassword) {
        return Account.builder()
            .userId(request.getUserId())
            .username(request.getUsername())
            .password(encodedPassword)
            .role("ROLE_USER")
            .state(false)
            .build();
    }

    public static Account fromAdmin(SignupRequest request, String encodedPassword) {
        return Account.builder()
            .userId(request.getUserId())
            .username(request.getUsername())
            .password(encodedPassword)
            .role("ROLE_USER")
            .state(true)
            .build();
    }

    public void updateRefreshTokenHash(String tokenHash){
        this.refreshTokenHash = tokenHash;
    }

    // 로그아웃 / 비밀번호·권한 변경 시 → 이후 reissue 불가
    public void clearRefreshTokenHash(){
        this.refreshTokenHash = null;
    }

    public void updateRole(String role){
        this.role = role;
        this.state = true;
    }

    public void updatePassword(String encodedPassword){
        this.password = encodedPassword;
    }
}
