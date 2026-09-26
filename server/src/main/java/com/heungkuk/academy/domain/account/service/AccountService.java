package com.heungkuk.academy.domain.account.service;

import java.util.List;
import com.heungkuk.academy.domain.account.dto.request.SignupRequest;
import com.heungkuk.academy.domain.account.dto.response.AccountResponse;
import com.heungkuk.academy.domain.account.dto.response.SignupResponse;

/** 계정 관리 기능 인터페이스 */
public interface AccountService {

    /** 계정 생성 (관리자가 직접 등록, 즉시 활성화) */
    SignupResponse createAccount(SignupRequest request);

    /** 전체 계정 목록 조회 */
    List<AccountResponse> getAccounts();

    /** 계정 삭제 */
    void deleteAccount(Long id);

    /** 계정 역할 변경 (ROLE_ADMIN ↔ ROLE_USER, 그 외 값은 INVALID_ROLE / 마지막 관리자 강등 불가) */
    void updateRole(Long id, String role);

    /** 비밀번호 변경 (ID 기준) */
    void updatePassword(Long id, String newPassword);

    /** 비밀번호 변경 (userId 기준) */
    void updatePasswordByUserId(String userId, String newPassword);
}
