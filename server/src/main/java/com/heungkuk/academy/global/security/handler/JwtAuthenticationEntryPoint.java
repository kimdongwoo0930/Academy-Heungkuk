package com.heungkuk.academy.global.security.handler;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.heungkuk.academy.global.exception.ErrorCode;
import com.heungkuk.academy.global.response.CommonResponse;
import lombok.RequiredArgsConstructor;

/**
 * 미인증 요청(토큰 없음 / 만료 / 위조)이 보호된 경로에 접근하면 호출 → 401
 * Security 필터 단계에서 발생하므로 @RestControllerAdvice 로는 잡을 수 없어 여기서 직접 응답을 쓴다.
 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        ErrorCode errorCode = ErrorCode.UNAUTHORIZED;
        response.setStatus(errorCode.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), CommonResponse.error(errorCode.getMessage()));
    }
}
