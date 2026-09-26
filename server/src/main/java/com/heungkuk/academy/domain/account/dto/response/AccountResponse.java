package com.heungkuk.academy.domain.account.dto.response;

import java.time.LocalDateTime;

import com.heungkuk.academy.domain.account.entity.Account;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

@Schema(description = "계정 정보 응답")
@Getter
@Builder
public class AccountResponse {
    @Schema(description = "계정 ID", example = "1")
    private Long id;
    @Schema(description = "로그인 아이디", example = "admin01")
    private String userId;
    @Schema(description = "직원 이름", example = "홍길동")
    private String username;
    @Schema(description = "권한", example = "ROLE_ADMIN")
    private String role;
    @Schema(description = "승인 여부", example = "true")
    private Boolean state;
    @Schema(description = "가입일시")
    private LocalDateTime createdAt;

    public static AccountResponse of(Account account){
        return AccountResponse.builder()
            .id(account.getId())
            .userId(account.getUserId())
            .username(account.getUsername())
            .role(account.getRole().name())
            .state(account.getState())
            .createdAt(account.getCreatedAt())
            .build();
    }

}
