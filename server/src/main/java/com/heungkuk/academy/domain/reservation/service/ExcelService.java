package com.heungkuk.academy.domain.reservation.service;

import org.springframework.web.multipart.MultipartFile;
import com.heungkuk.academy.domain.reservation.dto.response.ImportResult;

/** Excel 파일 생성·내보내기·가져오기 기능 인터페이스 */
public interface ExcelService {

    /** 견적서 xlsx 생성 (템플릿 기반, 예약 ID 기준) */
    byte[] generateEstimate(Long reservationId, String userId);

    /** 전체 예약 데이터 xlsx 내보내기 */
    byte[] exportAll(String userId);

    /** xlsx 파일 업로드로 예약 데이터 일괄 등록·수정 (예약 코드 기준) */
    ImportResult importAll(MultipartFile file);

    /** 거래명세서 xlsx 생성 (템플릿 기반, 예약 ID 기준) */
    byte[] generateTrade(Long reservationId, String userId);

    /** 확인서 xlsx 생성 (예약 ID 기준) */
    byte[] generateConfirmation(Long reservationId, String userId);
}
