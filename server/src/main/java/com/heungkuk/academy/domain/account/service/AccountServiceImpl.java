package com.heungkuk.academy.domain.account.service;

import java.util.ArrayList;
import java.util.List;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.heungkuk.academy.domain.account.dto.request.SignupRequest;
import com.heungkuk.academy.domain.account.dto.response.AccountResponse;
import com.heungkuk.academy.domain.account.dto.response.SignupResponse;
import com.heungkuk.academy.domain.account.entity.Account;
import com.heungkuk.academy.domain.account.repository.AccountRepository;
import com.heungkuk.academy.domain.account.repository.RefreshTokenRepository;
import com.heungkuk.academy.global.exception.BusinessException;
import com.heungkuk.academy.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AccountServiceImpl implements AccountService {

    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;

    // 관리자가 계정 생성 (state=true, 즉시 활성화)
    @Override
    @Transactional
    public SignupResponse createAccount(SignupRequest request) {
        if (accountRepository.existsByUserId(request.getUserId())) {
            throw new BusinessException(ErrorCode.DUPLICATE_USER_ID);
        }
        String encodedPassword = passwordEncoder.encode(request.getPassword());
        Account account = Account.fromAdmin(request, encodedPassword);
        accountRepository.save(account);
        log.info("계정 생성: userId={}, username={}, role={}", account.getUserId(), account.getUsername(), account.getRole());
        return SignupResponse.of(account);
    }

    /**
     * 회원 정보 조회
     *
     * @return List<AccountResponse>
     */
    @Override
    public List<AccountResponse> getAccounts() {
        List<Account> accounts = accountRepository.findAll();
        List<AccountResponse> response = new ArrayList<>();
        for (Account a : accounts) {
            response.add(AccountResponse.of(a));
        }
        return response;
    }

    /**
     * 계정 삭제
     * 
     * @param id
     */
    @Override
    @Transactional
    public void deleteAccount(Long id) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));
        log.info("계정 삭제: userId={}, username={}", account.getUserId(), account.getUsername());
        // 세션(refresh_token)이 계정을 FK 로 참조하므로 먼저 삭제 → 모든 기기 로그아웃
        refreshTokenRepository.deleteAllByAccount(account);
        accountRepository.delete(account);
    }

    /**
     * 일반유저/ 관리자 전환
     * 
     * @param id
     * @param role
     */
    @Override
    @Transactional
    public void updateRole(Long id, String role) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));
        log.info("권한 변경: userId={}, {} → {}", account.getUserId(), account.getRole(), role);
        account.updateRole(role);
    }

    /**
     * 비밀번호 변경
     * 
     * @param id
     * @param newPassword
     */
    @Override
    @Transactional
    public void updatePassword(Long id, String newPassword) {
        Account account = accountRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));
        account.updatePassword(passwordEncoder.encode(newPassword));
        log.info("비밀번호 변경: userId={}", account.getUserId());
    }

    @Override
    @Transactional
    public void updatePasswordByUserId(String userId, String newPassword) {
        Account account = accountRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));
        account.updatePassword(passwordEncoder.encode(newPassword));
    }



}
