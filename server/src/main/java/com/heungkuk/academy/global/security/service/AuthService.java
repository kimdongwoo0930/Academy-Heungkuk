package com.heungkuk.academy.global.security.service;

import java.util.UUID;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.heungkuk.academy.domain.account.dto.request.LoginRequest;
import com.heungkuk.academy.domain.account.dto.response.LoginResponse;
import com.heungkuk.academy.domain.account.entity.Account;
import com.heungkuk.academy.domain.account.repository.AccountRepository;
import com.heungkuk.academy.global.exception.BusinessException;
import com.heungkuk.academy.global.exception.ErrorCode;
import com.heungkuk.academy.global.security.jwt.JwtProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AuthService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    // 없는 계정 로그인 시 비교용 가짜 해시
    private String dummyPasswordHash;

    // 서버가 뜰때 한번만 만들어서 정해둔다.
    @PostConstruct
    void initDummyPasswordHash() {
        dummyPasswordHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }


    /**
     * 로그인 함수
     *
     * @param request
     * @return LoginResponse
     */
    public LoginResponse login(LoginRequest request) {
        // 1. userId로 Account 조회 → 없으면 예외
        // 없는 계정이어도 BCrypt 비교를 한 번 수행해 응답 시간으로 계정 존재 여부가 드러나지 않게 한다
        Account account = accountRepository.findByUserId(request.getUserId())
                .orElseThrow(() -> {
                    passwordEncoder.matches(request.getPassword(), dummyPasswordHash);
                    log.warn("로그인 실패 - 존재하지 않는 계정: userId={}", request.getUserId());
                    return new BusinessException(ErrorCode.LOGIN_FAILED);
                });
        // 2. 비밀번호 검증 (passwordEncoder.matches) → 틀리면 예외
        // 응답은 없는 계정과 동일하게 LOGIN_FAILED (로그로만 원인 구분)
        if (!passwordEncoder.matches(request.getPassword(), account.getPassword())) {
            log.warn("로그인 실패 - 비밀번호 불일치: userId={}", request.getUserId());
            throw new BusinessException(ErrorCode.LOGIN_FAILED);
        }
        // 3. accessToken, refreshToken 생성
        String accessToken =
                jwtProvider.generateAccessToken(account.getUserId(), account.getRole());
        String refreshToken = jwtProvider.generateRefreshToken(account.getUserId());
        // 5. refreshToken DB 저장
        account.updateRefreshToken(refreshToken);
        log.info("로그인 성공: userId={}, role={}", account.getUserId(), account.getRole());
        // 6. LoginResponse 반환
        return LoginResponse.of(accessToken, refreshToken);
    }

    /**
     * 토큰 재발급 함수
     *
     * @param refreshToken
     * @return accessToken
     */
    public LoginResponse reissue(String refreshToken) {
        // 1. refreshToken 자체가 유효한지 검증 (만료됐거나 위조된 토큰 차단)
        // → jwtProvider.validateToken(refreshToken) 이 false면 예외
        if (!jwtProvider.validateToken(refreshToken)) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }
        // 2. 유효하면 토큰 안에서 userId 꺼내기
        // → jwtProvider.getUserId(refreshToken)
        String userId = jwtProvider.getUserId(refreshToken);

        // 3. userId로 DB에서 Account 조회 → 없으면 예외
        // → accountRepository.findByUserId(userId)
        Account account = accountRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ACCOUNT_NOT_FOUND));

        // 4. DB에 저장된 refreshToken과 요청으로 온 refreshToken 비교
        // → account.getRefreshToken().equals(refreshToken) 이 false면 예외
        // (왜? 누군가 토큰을 훔쳤을 때 관리자가 DB에서 지우면 막을 수 있음)
        if (!account.getRefreshToken().equals(refreshToken)) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        // 5. 새 accessToken 생성 (role도 필요하니까 account.getRole() 사용)
        // → jwtProvider.generateAccessToken(userId, role)
        String accessToken =
                jwtProvider.generateAccessToken(account.getUserId(), account.getRole());

        // 6. LoginResponse 반환 refreshToken은 기존 거 그대로
        return LoginResponse.of(accessToken, refreshToken);
    }
}


