package com.heungkuk.academy.domain.reservation.controller;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import com.heungkuk.academy.domain.reservation.dto.response.ImportResult;
import com.heungkuk.academy.domain.reservation.service.ExcelService;
import com.heungkuk.academy.domain.reservation.service.ReservationService;
import com.heungkuk.academy.global.response.CommonResponse;

@Tag(name = "Excel", description = "견적서 / 거래명세서 / 확인서 / 내보내기 / 가져오기 API")
@SecurityRequirement(name = "Bearer")
@RestController
@RequestMapping("/v1/admin/reservations")
@RequiredArgsConstructor
public class ExcelController {

    private final ExcelService excelService;
    private final ReservationService reservationService;

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private ResponseEntity<byte[]> xlsxResponse(byte[] bytes, String fileName) {
        String encoded = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replace("+", "%20");
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded + ".xlsx");
        headers.setContentType(XLSX);
        headers.setContentLength(bytes.length);
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    @Operation(summary = "견적서 다운로드")
    @GetMapping("/{id}/estimate")
    public ResponseEntity<byte[]> downloadEstimate(
            @Parameter(description = "예약 ID") @PathVariable Long id,
            @AuthenticationPrincipal String userId
    ) {
        byte[] bytes = excelService.generateEstimate(id, userId);
        String org = reservationService.getReservation(id).getOrganization();
        return xlsxResponse(bytes, "흥국생명용인연수원_견적서_" + org);
    }

    @Operation(summary = "거래명세서 다운로드")
    @GetMapping("/{id}/trade")
    public ResponseEntity<byte[]> downloadTrade(
            @Parameter(description = "예약 ID") @PathVariable Long id,
            @AuthenticationPrincipal String userId
    ) {
        byte[] bytes = excelService.generateTrade(id, userId);
        String org = reservationService.getReservation(id).getOrganization();
        return xlsxResponse(bytes, "흥국생명용인연수원_거래명세서_" + org);
    }

    @Operation(summary = "확인서 다운로드")
    @GetMapping("/{id}/confirmation")
    public ResponseEntity<byte[]> downloadConfirmation(
            @Parameter(description = "예약 ID") @PathVariable Long id,
            @AuthenticationPrincipal String userId
    ) {
        byte[] bytes = excelService.generateConfirmation(id, userId);
        String org = reservationService.getReservation(id).getOrganization();
        return xlsxResponse(bytes, "흥국생명용인연수원_확인서_" + org);
    }

    @Operation(summary = "예약 데이터 Excel 내보내기")
    @GetMapping("/export")
    public ResponseEntity<byte[]> exportReservations(
            @AuthenticationPrincipal String userId
    ) {
        return xlsxResponse(excelService.exportAll(userId), "reservations_export");
    }

    @Operation(summary = "예약 데이터 Excel 가져오기")
    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<CommonResponse<ImportResult>> importReservations(
            @RequestParam MultipartFile file) {
        return ResponseEntity.ok(CommonResponse.success(excelService.importAll(file)));
    }
}
