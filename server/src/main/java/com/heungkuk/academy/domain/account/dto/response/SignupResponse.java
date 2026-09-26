package com.heungkuk.academy.domain.account.dto.response;

import com.heungkuk.academy.domain.account.entity.Account;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Schema(description = "회원가입 응답")
@Getter
@Builder
public class SignupResponse {

    @Schema(description = "계정 ID", example = "1")
    private Long id;
    @Schema(description = "로그인 아이디", example = "test123")
    private String userId;
    @Schema(description = "직원 이름", example = "김동우")
    private String username;
    @Schema(description = "권한", example = "ROLE_USER")
    private String role;
    @Schema(description = "승인 여부 (가입 직후 false)", example = "false")
    private boolean state;


    public static SignupResponse of(Account account) {
        return SignupResponse.builder()
            .id(account.getId())
            .userId(account.getUserId())
            .username(account.getUsername())
            .role(account.getRole().name())
            .state(account.getState())
            .build();
}

}
