package com.heungkuk.academy.domain.account.controller;

import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import com.heungkuk.academy.domain.account.dto.request.PasswordChangeRequest;
import com.heungkuk.academy.domain.account.dto.request.SignupRequest;
import com.heungkuk.academy.domain.account.dto.response.AccountResponse;
import com.heungkuk.academy.domain.account.dto.response.SignupResponse;
import com.heungkuk.academy.domain.account.service.AccountService;
import com.heungkuk.academy.global.response.CommonResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;


@Tag(name = "계정 관리", description = "직원 계정 조회 / 권한 변경 / 삭제 API (관리자 전용)")
@SecurityRequirement(name = "Bearer")
@RestController
@RequestMapping("/v1/admin/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @Operation(summary = "계정 생성", description = "관리자가 새 계정을 생성합니다. 생성된 계정은 즉시 활성화됩니다.", hidden = true)
    @PostMapping
    public ResponseEntity<CommonResponse<SignupResponse>> createAccount(
            @RequestBody SignupRequest request,
            @AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(CommonResponse.success(accountService.createAccount(request, userId)));
    }

    @Operation(summary = "계정 목록 조회", description = "전체 직원 계정 목록을 반환합니다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 실패 (토큰 없음 또는 만료)"),
            @ApiResponse(responseCode = "403", description = "접근 권한 없음")})
    @GetMapping
    public ResponseEntity<CommonResponse<List<AccountResponse>>> getAccounts(@AuthenticationPrincipal String userId) {
        return ResponseEntity.ok(CommonResponse.success(accountService.getAccounts(userId)));
    }

    @Operation(summary = "권한 변경",
            description = "계정의 role을 변경합니다. role 변경 시 state(승인 여부)가 자동으로 true로 설정됩니다.\n\n"
                    + "- `ROLE_ADMIN`: 관리자\n" + "- `ROLE_USER`: 일반 직원")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "권한 변경 성공"),
            @ApiResponse(responseCode = "404", description = "계정을 찾을 수 없음"),
            @ApiResponse(responseCode = "401", description = "인증 실패"),
            @ApiResponse(responseCode = "403", description = "접근 권한 없음")})
    @PatchMapping("/{id}/role")
    public ResponseEntity<CommonResponse<Void>> updateRole(
            @Parameter(description = "계정 ID", example = "1") @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        accountService.updateRole(id, body.get("role"));
        return ResponseEntity.ok(CommonResponse.success(null));
    }

    @Operation(summary = "계정 삭제", description = "계정을 영구 삭제합니다.")
    @ApiResponses({@ApiResponse(responseCode = "200", description = "삭제 성공"),
            @ApiResponse(responseCode = "404", description = "계정을 찾을 수 없음"),
            @ApiResponse(responseCode = "401", description = "인증 실패"),
            @ApiResponse(responseCode = "403", description = "접근 권한 없음")})
    @DeleteMapping("/{id}")
    public ResponseEntity<CommonResponse<Void>> deleteAccount(
            @Parameter(description = "계정 ID", example = "1") @PathVariable Long id) {
        accountService.deleteAccount(id);
        return ResponseEntity.ok(CommonResponse.success(null));
    }

    @Operation(summary = "비밀번호 변경 (관리자)", description = "관리자가 특정 계정의 비밀번호를 변경합니다.")
    @PatchMapping("/{id}/password")
    public ResponseEntity<CommonResponse<Void>> updatePassword(
            @Parameter(description = "계정 ID", example = "1") @PathVariable Long id,
            @RequestBody PasswordChangeRequest request) {
        accountService.updatePassword(id, request.getNewPassword());
        return ResponseEntity.ok(CommonResponse.success(null));
    }

    @Operation(summary = "내 비밀번호 변경", description = "로그인한 본인의 비밀번호를 변경합니다.")
    @PatchMapping("/me/password")
    public ResponseEntity<CommonResponse<Void>> updateMyPassword(
            @AuthenticationPrincipal String userId, @RequestBody PasswordChangeRequest request) {
        accountService.updatePasswordByUserId(userId, request.getNewPassword());
        return ResponseEntity.ok(CommonResponse.success(null));
    }

}
