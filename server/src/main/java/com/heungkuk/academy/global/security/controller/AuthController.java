package com.heungkuk.academy.global.security.controller;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.heungkuk.academy.domain.account.dto.request.LoginRequest;
import com.heungkuk.academy.domain.account.dto.response.LoginResponse;
import com.heungkuk.academy.global.response.CommonResponse;
import com.heungkuk.academy.global.security.dto.AuthTokens;
import com.heungkuk.academy.global.security.jwt.RefreshTokenCookieProvider;
import com.heungkuk.academy.global.security.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;


@Tag(name = "인증", description = "로그인 / 토큰 재발급 API")
@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final RefreshTokenCookieProvider refreshTokenCookieProvider;

    @Operation(summary = "로그인",
            description = "accessToken 은 응답 바디로, refreshToken 은 HttpOnly 쿠키(Set-Cookie, Path=/v1/auth)로 발급합니다.")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "로그인 성공"),
            @ApiResponse(responseCode = "401", description = "회원정보 불일치"),
            @ApiResponse(responseCode = "403", description = "접근 권한 없음")})
    @PostMapping("/login")
    public ResponseEntity<CommonResponse<LoginResponse>> login(@RequestBody LoginRequest request) {
        AuthTokens tokens = authService.login(request);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshTokenCookieProvider.create(tokens.refreshToken()).toString())
                .body(CommonResponse.success(LoginResponse.of(tokens.accessToken())));
    }

    @Operation(summary = "토큰 재발급",
            description = "refreshToken 쿠키로 새 accessToken(바디)과 새 refreshToken(쿠키)을 발급합니다. (rotation)")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "토큰 재발급 성공"),
            @ApiResponse(responseCode = "401", description = "리프레시 토큰이 없거나 유효하지 않음")})
    @PostMapping("/reissue")
    public ResponseEntity<CommonResponse<LoginResponse>> reissue(
            @Parameter(hidden = true)
            @CookieValue(name = RefreshTokenCookieProvider.COOKIE_NAME, required = false) String refreshToken) {
        AuthTokens tokens = authService.reissue(refreshToken);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE,
                        refreshTokenCookieProvider.create(tokens.refreshToken()).toString())
                .body(CommonResponse.success(LoginResponse.of(tokens.accessToken())));
    }

    @Operation(summary = "로그아웃",
            description = "이 기기의 로그인 세션을 삭제하고 refreshToken 쿠키를 만료시킵니다. 쿠키가 없거나 무효여도 항상 성공합니다.")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "로그아웃 성공")})
    @PostMapping("/logout")
    public ResponseEntity<CommonResponse<Void>> logout(
            @Parameter(hidden = true)
            @CookieValue(name = RefreshTokenCookieProvider.COOKIE_NAME, required = false) String refreshToken) {
        authService.logout(refreshToken);
        // HttpOnly 쿠키는 JS 로 지울 수 없으므로 서버가 같은 이름·Path 에 Max-Age=0 으로 만료시킨다
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookieProvider.expire().toString())
                .body(CommonResponse.success(null));
    }
}
