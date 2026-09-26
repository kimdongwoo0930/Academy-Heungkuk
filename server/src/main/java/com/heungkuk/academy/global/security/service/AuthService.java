package com.heungkuk.academy.global.security.service;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.heungkuk.academy.domain.account.dto.request.LoginRequest;
import com.heungkuk.academy.domain.account.entity.Account;
import com.heungkuk.academy.domain.account.entity.RefreshToken;
import com.heungkuk.academy.domain.account.repository.AccountRepository;
import com.heungkuk.academy.domain.account.repository.RefreshTokenRepository;
import com.heungkuk.academy.global.exception.BusinessException;
import com.heungkuk.academy.global.exception.ErrorCode;
import com.heungkuk.academy.global.security.dto.AuthTokens;
import com.heungkuk.academy.global.security.jwt.JwtProvider;
import com.heungkuk.academy.global.security.jwt.TokenHashUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class AuthService {

    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
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
     * @return AuthTokens (access 는 바디, refresh 는 쿠키로 컨트롤러에서 내보냄)
     */
    public AuthTokens login(LoginRequest request) {
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
        // 3. 이 로그인(기기)의 세션 ID 생성 후 accessToken, refreshToken 생성
        String sessionId = UUID.randomUUID().toString();
        String accessToken =
                jwtProvider.generateAccessToken(account.getUserId(), account.getRole().name());
        String refreshToken = jwtProvider.generateRefreshToken(account.getUserId(), sessionId);
        // 4. 이 계정의 만료된 세션 정리 (로그아웃 없이 버려진 기기 세션이 쌓이지 않게)
        refreshTokenRepository.deleteExpiredByAccount(account, LocalDateTime.now());
        // 5. 세션 1행 추가 — refreshToken 은 원문 대신 SHA-256 해시로 저장
        refreshTokenRepository.save(RefreshToken.of(account, sessionId,
                TokenHashUtil.sha256(refreshToken), jwtProvider.getExpiration(refreshToken)));
        log.info("로그인 성공: userId={}, role={}, sessionId={}", account.getUserId(),
                account.getRole(), sessionId);
        // 6. 발급한 토큰 반환
        return new AuthTokens(accessToken, refreshToken);
    }

    /**
     * 토큰 재발급 (rotation)
     * 쿠키의 refreshToken 으로 새 accessToken + 새 refreshToken 을 발급하고, 세션의 해시를 새 값으로 교체한다.
     * 실패 사유는 모두 INVALID_REFRESH_TOKEN(401) 로 통일 (어떤 이유로 실패했는지 외부에 드러내지 않음)
     *
     * @param refreshToken 쿠키에서 읽은 refresh 토큰 (없으면 null)
     * @return AuthTokens (새 access 는 바디, 새 refresh 는 쿠키로 컨트롤러에서 내보냄)
     */
    public AuthTokens reissue(String refreshToken) {
        // 1. refresh 토큰 자체 검증 — 쿠키 없음 / 만료 / 위조 / access 토큰을 넣은 경우 차단
        if (!jwtProvider.isRefreshToken(refreshToken)) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }
        String userId = jwtProvider.getUserId(refreshToken);
        String sessionId = jwtProvider.getSessionId(refreshToken);

        // 2. 세션 조회 — 없으면 로그아웃 / 비밀번호·권한 변경 / 계정 삭제 / 만료 정리된 세션
        RefreshToken session = (sessionId == null) ? null
                : refreshTokenRepository.findBySessionId(sessionId).orElse(null);
        if (session == null) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        // 3. 세션의 계정과 토큰의 userId 가 같은지 확인
        Account account = session.getAccount();
        if (!account.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        // 4. 현재 유효한 토큰인지 해시 비교 — 이미 교체된(rotation 전) 옛 토큰이면 불일치
        //    탈취 의심 시 강제 로그아웃은 하지 않고 거부 + 로그만 남긴다
        if (!TokenHashUtil.matches(refreshToken, session.getTokenHash())) {
            log.warn("재발급 거부 - 이미 교체된 refresh 토큰 사용: userId={}, sessionId={}", userId,
                    sessionId);
            throw new BusinessException(ErrorCode.INVALID_REFRESH_TOKEN);
        }

        // 5. rotation — 같은 세션 ID 로 새 토큰 발급, 세션의 해시·만료 시각 교체
        String newAccessToken =
                jwtProvider.generateAccessToken(account.getUserId(), account.getRole().name());
        String newRefreshToken = jwtProvider.generateRefreshToken(account.getUserId(), sessionId);
        session.rotate(TokenHashUtil.sha256(newRefreshToken),
                jwtProvider.getExpiration(newRefreshToken));

        return new AuthTokens(newAccessToken, newRefreshToken);
    }

    /**
     * 로그아웃 — 이 기기의 세션만 삭제 (다른 기기 세션은 유지)
     * 쿠키가 없거나 무효여도 예외를 던지지 않는다. 로그아웃은 항상 성공하고, 쿠키 만료는 컨트롤러가 내려준다.
     *
     * @param refreshToken 쿠키에서 읽은 refresh 토큰 (없으면 null)
     */
    public void logout(String refreshToken) {
        // 없음 / 만료 / 위조 / access 토큰 → 지울 세션을 특정할 수 없으므로 할 일 없음
        if (!jwtProvider.isRefreshToken(refreshToken)) {
            return;
        }
        String sessionId = jwtProvider.getSessionId(refreshToken);
        if (sessionId == null) {
            return;
        }
        // 현재 유효한 토큰일 때만 삭제 — 이미 교체된 옛 토큰으로 남의 세션을 끊지 못하게
        refreshTokenRepository.findBySessionId(sessionId)
                .filter(session -> TokenHashUtil.matches(refreshToken, session.getTokenHash()))
                .ifPresent(session -> {
                    refreshTokenRepository.delete(session);
                    log.info("로그아웃: userId={}, sessionId={}", jwtProvider.getUserId(refreshToken),
                            sessionId);
                });
    }
}
