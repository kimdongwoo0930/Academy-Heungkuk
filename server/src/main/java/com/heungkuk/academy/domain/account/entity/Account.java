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

    // refresh 토큰은 기기별 세션 테이블(refresh_token, RefreshToken 엔티티)에서 관리

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

    public void updateRole(String role){
        this.role = role;
        this.state = true;
    }

    public void updatePassword(String encodedPassword){
        this.password = encodedPassword;
    }
}
