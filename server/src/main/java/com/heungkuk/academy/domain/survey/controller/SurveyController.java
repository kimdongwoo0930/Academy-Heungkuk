package com.heungkuk.academy.domain.survey.controller;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.heungkuk.academy.domain.survey.dto.request.SurveyRequest;
import com.heungkuk.academy.domain.survey.dto.response.SurveyResponse;
import com.heungkuk.academy.domain.survey.dto.response.SurveyTokenResponse;
import com.heungkuk.academy.domain.survey.service.SurveyService;
import com.heungkuk.academy.global.response.CommonResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
@Tag(name = "Survey", description = "설문 API")
public class SurveyController {

    private final SurveyService surveyService;

    // 설문 URL 생성 (관리자)
    @Operation(summary = "설문 URL 생성")
    @PostMapping("/v1/admin/surveys/token/{reservationId}")
    public ResponseEntity<CommonResponse<SurveyTokenResponse>> createSurveyToken(
            @PathVariable String reservationId) {
        SurveyTokenResponse response = surveyService.createUrl(reservationId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    // 설문 토큰 사용 여부 확인 (고객, 인증 불필요)
    @Operation(summary = "설문 토큰 사용 여부 확인")
    @GetMapping("/v1/survey/check/{token}")
    public ResponseEntity<CommonResponse<Boolean>> checkSurveyToken(@PathVariable String token) {
        return ResponseEntity.ok(CommonResponse.success(surveyService.isTokenUsed(token)));
    }

    // 설문 응답 제출 (고객, 인증 불필요)
    @Operation(summary = "설문 응답 제출")
    @PostMapping("/v1/survey/{token}")
    public ResponseEntity<CommonResponse<Void>> submitSurvey(@PathVariable String token,
            @RequestBody SurveyRequest surveyRequest) {
        surveyService.saveSurvey(token, surveyRequest);
        return ResponseEntity.ok(CommonResponse.success(null));
    }

    // 설문 결과 조회 (관리자)
    @Operation(summary = "설문 결과 조회")
    @GetMapping("/v1/admin/surveys/{reservationId}")
    public ResponseEntity<CommonResponse<List<SurveyResponse>>> getSurveys(
            @PathVariable String reservationId) {
        List<SurveyResponse> response = surveyService.getSurveys(reservationId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @Operation(summary = "설문 토큰 조회")
    @GetMapping("/v1/admin/surveys/token/{reservationId}")
    public ResponseEntity<CommonResponse<SurveyTokenResponse>> getSurveyToken(
            @PathVariable String reservationId) {
        return ResponseEntity.ok(CommonResponse.success(surveyService.getToken(reservationId)));
    }

    @Operation(summary = "전체 설문 토큰 목록 조회")
    @GetMapping("/v1/admin/surveys/tokens")
    public ResponseEntity<CommonResponse<List<SurveyTokenResponse>>> getAllTokens() {
        return ResponseEntity.ok(CommonResponse.success(surveyService.getAllTokens()));
    }

    @Operation(summary = "전체 설문 목록 조회")
    @GetMapping("/v1/admin/surveys")
    public ResponseEntity<CommonResponse<List<SurveyResponse>>> getAllSurvey() {
        return ResponseEntity.ok(CommonResponse.success(surveyService.getSurveyList()));
    }

    @Operation(summary = "전체 설문 목록 조회 (검색·페이징)")
    @GetMapping("/v1/admin/surveys/search")
    public ResponseEntity<CommonResponse<Page<SurveyResponse>>> getSurveyPage(
            @RequestParam(required = false) String keyword,
            @PageableDefault(size = 20, sort = "createdAt",
                    direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(CommonResponse.success(
                surveyService.getSurveyPage(keyword, pageable)));
    }

}
