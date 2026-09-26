package com.heungkuk.academy.domain.account.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class LoginResponse {

    // refresh 토큰은 바디가 아니라 HttpOnly 쿠키(Set-Cookie)로 내려간다
    @Schema(description = "access Token", example = "암호화된 토큰")
    private String accessToken;

    public static LoginResponse of(String accessToken){
        return LoginResponse.builder()
            .accessToken(accessToken)
            .build();
    }
}
