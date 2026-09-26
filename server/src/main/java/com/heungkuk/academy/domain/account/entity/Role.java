package com.heungkuk.academy.domain.account.entity;

import com.heungkuk.academy.global.exception.BusinessException;
import com.heungkuk.academy.global.exception.ErrorCode;

/**
 * 계정 권한 — 정해진 값만 존재하도록 문자열 대신 enum 으로 관리
 * DB 에는 @Enumerated(EnumType.STRING) 으로 이름("ROLE_ADMIN")이 그대로 저장되고,
 * JWT role 클레임 / Spring Security 권한 문자열로는 name() 을 사용한다.
 */
public enum Role {
    ROLE_ADMIN,
    ROLE_USER;

    /** 요청 문자열 → Role (null 이거나 목록에 없는 값이면 INVALID_ROLE 400) */
    public static Role from(String value) {
        if (value == null) {
            throw new BusinessException(ErrorCode.INVALID_ROLE);
        }
        try {
            return Role.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(ErrorCode.INVALID_ROLE);
        }
    }
}
