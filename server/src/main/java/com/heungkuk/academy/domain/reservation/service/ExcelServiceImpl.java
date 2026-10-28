package com.heungkuk.academy.domain.reservation.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import com.heungkuk.academy.global.entity.LogNames;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import com.heungkuk.academy.domain.reservation.dto.response.ImportResult;
import com.heungkuk.academy.domain.reservation.entity.ClassroomReservation;
import com.heungkuk.academy.domain.reservation.entity.MealReservation;
import com.heungkuk.academy.domain.reservation.entity.Reservation;
import com.heungkuk.academy.domain.reservation.entity.RoomReservation;
import com.heungkuk.academy.domain.reservation.repository.ClassroomReservationRepository;
import com.heungkuk.academy.domain.reservation.repository.MealReservationRepository;
import com.heungkuk.academy.domain.reservation.repository.ReservationRepository;
import com.heungkuk.academy.domain.reservation.repository.RoomReservationRepository;
import com.heungkuk.academy.domain.setting.entity.AppSetting;
import com.heungkuk.academy.domain.setting.repository.AppSettingRepository;
import com.heungkuk.academy.global.exception.BusinessException;
import com.heungkuk.academy.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * Excel 통합 서비스
 *
 * 견적서(generateEstimate), 거래명세서(generateTrade), 전체 내보내기(exportAll), 전체 가져오기(importAll) 기능을 하나의 클래스로
 * 통합합니다.
 */
@Slf4j(topic = LogNames.RESERVATION)
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExcelServiceImpl implements ExcelService {

    private final ReservationRepository reservationRepository;
    private final RoomReservationRepository roomReservationRepository;
    private final ClassroomReservationRepository classroomReservationRepository;
    private final MealReservationRepository mealReservationRepository;
    private final AppSettingRepository appSettingRepository;

    // ══════════════════════════════════════════════════════════════════════════
    // 공통 상수 — 숙박·강의실 매핑
    // ══════════════════════════════════════════════════════════════════════════

    private static final Map<String, String> ROOM_TYPE =
            Map.ofEntries(Map.entry("101", "4인실"), Map.entry("102", "4인실"), Map.entry("103", "4인실"),
                    Map.entry("104", "4인실"), Map.entry("105", "4인실"), Map.entry("106", "4인실"),
                    Map.entry("107", "4인실"), Map.entry("108", "4인실"), Map.entry("109", "1인실"),
                    Map.entry("110", "2인실"), Map.entry("111", "2인실"), Map.entry("112", "4인실"),
                    Map.entry("113", "4인실"), Map.entry("114", "4인실"), Map.entry("115", "4인실"),
                    Map.entry("116", "4인실"), Map.entry("117", "4인실"), Map.entry("118", "4인실"),
                    Map.entry("119", "4인실"), Map.entry("120", "4인실"), Map.entry("121", "4인실"),
                    Map.entry("122", "4인실"), Map.entry("123", "4인실"), Map.entry("124", "4인실"),
                    Map.entry("125", "4인실"), Map.entry("126", "1인실"), Map.entry("127", "2인실"));

    private static final Map<String, String> CLASSROOM_CATEGORY = Map.ofEntries(
            Map.entry("105", "대형(120인)"), Map.entry("201", "중형(70인)"), Map.entry("203", "중형(50인)"),
            Map.entry("204", "중형(50인)"), Map.entry("101", "소형(30인)"), Map.entry("103", "소형(30인)"),
            Map.entry("202", "소형(30인)"), Map.entry("102", "소형(20인)"), Map.entry("106", "분임실(12인)"),
            Map.entry("107", "분임실(12인)"), Map.entry("205", "분임실(12인)"),
            Map.entry("206", "분임실(12인)"), Map.entry("A", "다목적실"), Map.entry("B", "다목적실"));

    // ══════════════════════════════════════════════════════════════════════════
    // 견적서 (generateEstimate)
    // ══════════════════════════════════════════════════════════════════════════

    // ── 강의실 카테고리 → 견적서 row index (0-based) ──────────────────────────
    private static final Map<String, Integer> CLASSROOM_ROW = Map.of("대형(120인)", 21, "중형(70인)", 22,
            "중형(50인)", 23, "소형(30인)", 24, "소형(20인)", 25, "분임실(12인)", 27, "다목적실", 28);

    /**
     * 견적서 xlsx 생성 후 byte[] 반환. 템플릿: classpath:/templates/estimate_template.xlsx
     */
    @Override
    public byte[] generateEstimate(Long reservationId, String userId) {
        Reservation res = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESERVATION_NOT_FOUND));

        List<RoomReservation> rooms = roomReservationRepository.findByReservation(res);
        List<ClassroomReservation> classrooms =
                classroomReservationRepository.findByReservation(res);
        List<MealReservation> meals = mealReservationRepository.findByReservation(res);

        Map<String, String> settings = appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getSettingKey, AppSetting::getSettingValue));

        long roomPrice = toLong(settings.getOrDefault("price.room", "85000"));
        long mealPrice = toLong(settings.getOrDefault("price.meal", "8300"));
        long specialMealPrice = toLong(settings.getOrDefault("price.specialMeal", "35000"));

        try (InputStream is = getClass().getResourceAsStream("/templates/estimate_template.xlsx");
                XSSFWorkbook wb = new XSSFWorkbook(is)) {

            XSSFSheet sheet = wb.getSheetAt(0);

            fillEstimateHeader(sheet, res, settings);
            long[] facilityTotals = fillEstimateRooms(sheet, rooms, roomPrice);
            long[] classroomTotals = fillEstimateClassrooms(sheet, classrooms, settings);
            fillEstimateFacilityTotals(sheet, facilityTotals, classroomTotals);
            long[] mealTotals = fillEstimateMeals(sheet, meals, mealPrice, specialMealPrice);
            fillEstimateGrandTotals(sheet, facilityTotals, classroomTotals, mealTotals);
            fillEstimateMealTable(sheet, meals);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            log.info("견적서 생성 완료 reservationId={}, 생성자={}", reservationId, userId);
            return out.toByteArray();

        } catch (IOException e) {
            log.error("견적서 생성 실패 reservationId={} 생성자={}", reservationId, userId, e);
            throw new RuntimeException("견적서 생성 중 오류가 발생했습니다.");
        }
    }

    // ── 견적서 단계별 채우기 ──────────────────────────────────────────────────

    private void fillEstimateHeader(XSSFSheet sheet, Reservation res,
            Map<String, String> settings) {
        setStr(sheet, 4, 0, res.getOrganization()); // A5: 수신 단체명
        getOrCreate(sheet, 8, 3).setCellValue(formatDateWithDay(LocalDate.now())); // D9: 견적일자
        setStr(sheet, 9, 3, res.getCustomer() + "님"); // D10: 고객사 담당자
        setStr(sheet, 10, 3, res.getCustomerPhone()); // D11: 연락처
        setStr(sheet, 11, 3, nvl(res.getCustomerEmail())); // D12: 이메일
        setStr(sheet, 13, 3, res.getOrganization()); // D14: 회사명
        setStr(sheet, 14, 3, nvl(res.getPurpose())); // D15: 교육명칭
        setStr(sheet, 15, 2, formatDateWithDay(res.getStartDate())); // C16: 시작일
        setStr(sheet, 15, 9, formatDateWithDay(res.getEndDate())); // J16: 종료일

        String representative = settings.getOrDefault("contact.representative", "");
        String manager = settings.getOrDefault("contact.manager", "");
        String phone = settings.getOrDefault("contact.phone", "");
        String fax = settings.getOrDefault("contact.fax", "");
        String email = settings.getOrDefault("contact.email", "");

        setStr(sheet, 5, 14, representative); // O6: 대표이사
        setStr(sheet, 8, 14, manager); // O9: 담당자
        setStr(sheet, 9, 14, "T. " + phone + "     F. " + fax); // O10: 전화/팩스
        setStr(sheet, 10, 14, email); // O11: 이메일
    }

    /** @return [subtotal, tax] */
    private long[] fillEstimateRooms(XSSFSheet sheet, List<RoomReservation> rooms, long roomPrice) {
        String[] typeKeys = {"4인실", "2인실", "1인실"};
        Map<String, List<RoomReservation>> byType = rooms.stream().collect(
                Collectors.groupingBy(r -> ROOM_TYPE.getOrDefault(r.getRoomNumber(), "4인실")));

        long totalSubtotal = 0, totalTax = 0;

        for (int ti = 0; ti < typeKeys.length; ti++) {
            int rowIdx = 18 + ti;
            List<RoomReservation> typeRooms = byType.getOrDefault(typeKeys[ti], List.of());

            if (typeRooms.isEmpty()) {
                blankCell(sheet, rowIdx, 5);
                blankCell(sheet, rowIdx, 8);
                setLong(sheet, rowIdx, 11, roomPrice);
                blankCell(sheet, rowIdx, 13);
                blankCell(sheet, rowIdx, 16);
                blankCell(sheet, rowIdx, 19);
                continue;
            }

            long nights =
                    typeRooms.stream().map(RoomReservation::getReservedDate).distinct().count();
            long roomCount =
                    typeRooms.stream().map(RoomReservation::getRoomNumber).distinct().count();
            long subtotal = nights * roomCount * roomPrice;
            long tax = Math.round(subtotal * 0.1);

            setLongNz(sheet, rowIdx, 5, nights);
            setLongNz(sheet, rowIdx, 8, roomCount);
            setLong(sheet, rowIdx, 11, roomPrice);
            setLongNz(sheet, rowIdx, 13, subtotal);
            setLongNz(sheet, rowIdx, 16, tax);
            setLongNz(sheet, rowIdx, 19, subtotal + tax);

            totalSubtotal += subtotal;
            totalTax += tax;
        }
        return new long[] {totalSubtotal, totalTax};
    }

    /** @return [subtotal, tax] */
    private long[] fillEstimateClassrooms(XSSFSheet sheet, List<ClassroomReservation> classrooms,
            Map<String, String> settings) {

        for (Map.Entry<String, Integer> e : CLASSROOM_ROW.entrySet()) {
            int rowIdx = e.getValue();
            long catPrice = toLong(settings.getOrDefault("price.classroom." + e.getKey(), "0"));
            blankCell(sheet, rowIdx, 5);
            blankCell(sheet, rowIdx, 8);
            setLong(sheet, rowIdx, 11, catPrice);
            blankCell(sheet, rowIdx, 13);
            blankCell(sheet, rowIdx, 16);
            blankCell(sheet, rowIdx, 19);
        }

        blankCell(sheet, 26, 13);
        blankCell(sheet, 26, 16);
        blankCell(sheet, 26, 19);
        Row progressRow = sheet.getRow(26);
        if (progressRow == null)
            progressRow = sheet.createRow(26);
        progressRow.setZeroHeight(true);

        Map<String, List<ClassroomReservation>> byCategory = classrooms.stream()
                .filter(c -> CLASSROOM_CATEGORY.containsKey(c.getClassroom()))
                .collect(Collectors.groupingBy(c -> CLASSROOM_CATEGORY.get(c.getClassroom())));

        long totalSubtotal = 0, totalTax = 0;

        for (Map.Entry<String, List<ClassroomReservation>> entry : byCategory.entrySet()) {
            Integer rowIdx = CLASSROOM_ROW.get(entry.getKey());
            if (rowIdx == null)
                continue;

            List<ClassroomReservation> list = entry.getValue();
            long catPrice = toLong(settings.getOrDefault("price.classroom." + entry.getKey(), "0"));
            long days = list.stream().map(ClassroomReservation::getReservedDate).distinct().count();
            long catCount =
                    list.stream().map(ClassroomReservation::getClassroom).distinct().count();
            long subtotal = days * catCount * catPrice;
            long tax = Math.round(subtotal * 0.1);

            setLongNz(sheet, rowIdx, 5, days);
            setLongNz(sheet, rowIdx, 8, catCount);
            setLong(sheet, rowIdx, 11, catPrice);
            setLongNz(sheet, rowIdx, 13, subtotal);
            setLongNz(sheet, rowIdx, 16, tax);
            setLongNz(sheet, rowIdx, 19, subtotal + tax);

            totalSubtotal += subtotal;
            totalTax += tax;
        }
        return new long[] {totalSubtotal, totalTax};
    }

    private void fillEstimateFacilityTotals(XSSFSheet sheet, long[] roomTotals,
            long[] classroomTotals) {
        long subtotal = roomTotals[0] + classroomTotals[0];
        long tax = roomTotals[1] + classroomTotals[1];

        setLongNz(sheet, 29, 13, subtotal);
        setLongNz(sheet, 29, 16, tax);
        setLongNz(sheet, 29, 19, subtotal + tax);

        setLongNz(sheet, 31, 13, subtotal);
        setLongNz(sheet, 31, 16, tax);
        setLongNz(sheet, 31, 19, subtotal + tax);
    }

    /** @return [normalSubtotal, normalTax, specialSubtotal, specialTax] */
    private long[] fillEstimateMeals(XSSFSheet sheet, List<MealReservation> meals, long mealPrice,
            long specialMealPrice) {
        int totalNormal = 0, totalSpecial = 0;

        for (MealReservation m : meals) {
            int b = nvlInt(m.getBreakfast());
            int l = nvlInt(m.getLunch());
            int d = nvlInt(m.getDinner());
            totalNormal += (!m.isSpecialBreakfast() ? b : 0) + (!m.isSpecialLunch() ? l : 0)
                    + (!m.isSpecialDinner() ? d : 0);
            totalSpecial += (m.isSpecialBreakfast() ? b : 0) + (m.isSpecialLunch() ? l : 0)
                    + (m.isSpecialDinner() ? d : 0);
        }

        long nSub = (long) totalNormal * mealPrice;
        long nTax = Math.round(nSub * 0.1);
        long sSub = (long) totalSpecial * specialMealPrice;
        long sTax = Math.round(sSub * 0.1);

        setLongNz(sheet, 33, 8, totalNormal);
        setLong(sheet, 33, 11, mealPrice);
        setLongNz(sheet, 33, 13, nSub);
        setLongNz(sheet, 33, 16, nTax);
        setLongNz(sheet, 33, 19, nSub + nTax);

        if (totalSpecial == 0) {
            blankCell(sheet, 34, 8);
            blankCell(sheet, 34, 13);
            blankCell(sheet, 34, 16);
            blankCell(sheet, 34, 19);
        } else {
            setLongNz(sheet, 34, 8, totalSpecial);
            setLong(sheet, 34, 11, specialMealPrice);
            setLongNz(sheet, 34, 13, sSub);
            setLongNz(sheet, 34, 16, sTax);
            setLongNz(sheet, 34, 19, sSub + sTax);
        }

        setLongNz(sheet, 35, 13, nSub + sSub);
        setLongNz(sheet, 35, 16, nTax + sTax);
        setLongNz(sheet, 35, 19, nSub + sSub + nTax + sTax);

        return new long[] {nSub, nTax, sSub, sTax};
    }

    private void fillEstimateGrandTotals(XSSFSheet sheet, long[] roomTotals, long[] classroomTotals,
            long[] mealTotals) {
        long facilitySubtotal = roomTotals[0] + classroomTotals[0];
        long facilityTax = roomTotals[1] + classroomTotals[1];
        long mealSubtotal = mealTotals[0] + mealTotals[2];
        long mealTax = mealTotals[1] + mealTotals[3];

        setLongNz(sheet, 37, 13, facilitySubtotal + mealSubtotal);
        setLongNz(sheet, 37, 16, facilityTax + mealTax);
        setLongNz(sheet, 37, 19, facilitySubtotal + mealSubtotal + facilityTax + mealTax);
    }

    private void fillEstimateMealTable(XSSFSheet sheet, List<MealReservation> meals) {
        if (meals.isEmpty())
            return;

        List<LocalDate> dates =
                meals.stream().map(MealReservation::getMealDate).sorted().distinct().toList();

        Map<LocalDate, MealReservation> byDate = meals.stream()
                .collect(Collectors.toMap(MealReservation::getMealDate, m -> m, (a, b) -> a));

        long[] rowTotals = {0, 0, 0};
        for (MealReservation m : meals) {
            rowTotals[0] += m.isSpecialBreakfast() ? 0 : nvlInt(m.getBreakfast());
            rowTotals[1] += m.isSpecialLunch() ? 0 : nvlInt(m.getLunch());
            rowTotals[2] += m.isSpecialDinner() ? 0 : nvlInt(m.getDinner());
        }

        boolean hasOverflow = dates.size() > 10;
        int visibleCount = hasOverflow ? 9 : dates.size();

        for (int i = 0; i < visibleCount; i++) {
            LocalDate d = dates.get(i);
            int col = 1 + (i * 2);

            setStr(sheet, 40, col, d.getDayOfMonth() + "일");

            MealReservation m = byDate.get(d);
            if (m == null)
                continue;

            int b = m.isSpecialBreakfast() ? 0 : nvlInt(m.getBreakfast());
            int l = m.isSpecialLunch() ? 0 : nvlInt(m.getLunch());
            int dn = m.isSpecialDinner() ? 0 : nvlInt(m.getDinner());

            setLongOrDash(sheet, 41, col, b);
            setLongOrDash(sheet, 42, col, l);
            setLongOrDash(sheet, 43, col, dn);
            setLongOrDash(sheet, 44, col, b + l + dn);

            sheet.autoSizeColumn(col);
            if (sheet.getColumnWidth(col) < 1400) {
                sheet.setColumnWidth(col, 1400);
            }
        }

        if (hasOverflow) {
            setStr(sheet, 40, 19, "…");
            setStr(sheet, 41, 19, "…");
            setStr(sheet, 42, 19, "…");
            setStr(sheet, 43, 19, "…");
            setStr(sheet, 44, 19, "…");
        }

        setLong(sheet, 41, 20, rowTotals[0]);
        setLong(sheet, 42, 20, rowTotals[1]);
        setLong(sheet, 43, 20, rowTotals[2]);
        setLong(sheet, 44, 20, rowTotals[0] + rowTotals[1] + rowTotals[2]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 거래명세서 (generateTrade)
    // ══════════════════════════════════════════════════════════════════════════

    // ── 카테고리 → 거래명세서 품목명 ──────────────────────────────────────────
    private static final Map<String, String> CATEGORY_LABEL = Map.of("대형(120인)", "시설사용료(대형)_120인",
            "중형(70인)", "시설사용료(중형)_70인", "중형(50인)", "시설사용료(중형)_50인", "소형(30인)", "시설사용료(소형)_30인",
            "소형(20인)", "시설사용료(소형)_20인", "분임실(12인)", "시설사용료(분임토의실)", "다목적실", "다목적실");

    private static final List<String> ROOM_ORDER = List.of("4인실", "2인실", "1인실");
    private static final List<String> CLASSROOM_ORDER =
            List.of("대형(120인)", "중형(70인)", "중형(50인)", "소형(30인)", "소형(20인)", "분임실(12인)", "다목적실");

    private static final int ITEM_START_ROW = 9;
    private static final int TEMPLATE_ITEM_ROWS = 15;

    private record TradeItem(String name, String spec, long qty, long unitPrice, long supply,
            long tax) {
    }

    /**
     * 거래명세서 xlsx 생성 후 byte[] 반환. 템플릿: classpath:/templates/trade_template.xlsx
     */
    @Override
    public byte[] generateTrade(Long reservationId, String userId) {
        Reservation res = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESERVATION_NOT_FOUND));

        List<RoomReservation> rooms = roomReservationRepository.findByReservation(res);
        List<ClassroomReservation> classrooms =
                classroomReservationRepository.findByReservation(res);

        Map<String, String> settings = appSettingRepository.findAll().stream()
                .collect(Collectors.toMap(AppSetting::getSettingKey, AppSetting::getSettingValue));

        long roomPrice = toLong(settings.getOrDefault("price.room", "85000"));

        try (InputStream is = getClass().getResourceAsStream("/templates/trade_template.xlsx");
                XSSFWorkbook wb = new XSSFWorkbook(is)) {

            XSSFSheet sheet = wb.getSheetAt(0);

            List<TradeItem> items = buildTradeItems(rooms, classrooms, settings, roomPrice);

            ensureItemRows(sheet, items.size());

            int kaeRow = findKaeRow(sheet);
            fillTradeHeader(sheet, res, settings);
            long[] totals = fillTradeItems(sheet, items, kaeRow);
            fillTradeTotals(sheet, totals, kaeRow);
            fillTradeContact(sheet, settings, kaeRow);

            wb.setForceFormulaRecalculation(true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            log.info("거래명세서 생성 성공 reservationId={} 생성자={}", reservationId, userId);
            return out.toByteArray();

        } catch (IOException e) {
            log.error("거래명세서 생성 실패 reservationId={} 생성자={}", reservationId, userId ,e);
            throw new RuntimeException("거래명세서 생성 중 오류가 발생했습니다.");
        }
    }

    /**
     * 확인서 xlsx 생성 후 byte[] 반환.
     */
    @Override
    public byte[] generateConfirmation(Long reservationId, String userId) {
        Reservation res = reservationRepository.findById(reservationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESERVATION_NOT_FOUND));
        List<RoomReservation> rooms = roomReservationRepository.findByReservation(res);
        List<ClassroomReservation> classrooms =
                classroomReservationRepository.findByReservation(res);
        List<MealReservation> meals = mealReservationRepository.findByReservation(res);

        try (InputStream is =
                getClass().getResourceAsStream("/templates/confirmation_template.xlsx")) {
            if (is == null) {
                throw new RuntimeException(
                        "확인서 템플릿이 없습니다. /templates/confirmation_template.xlsx 파일을 추가해주세요.");
            }

            try (XSSFWorkbook wb = new XSSFWorkbook(is)) {
                XSSFSheet sheet = wb.getSheetAt(0);
                fillConfirmationSheet(sheet, res, rooms, classrooms, meals);

                wb.setForceFormulaRecalculation(true);
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                wb.write(out);
                log.info("확인서 생성 성공 reservationId={} 생성자={}", reservationId, userId);
                return out.toByteArray();
            }
        } catch (IOException e) {
            log.error("확인서 생성 실패 reservationId={} 생성자={}", reservationId,userId, e);
            throw new RuntimeException("확인서 생성 중 오류가 발생했습니다.");
        }
    }

    private void fillConfirmationSheet(XSSFSheet sheet, Reservation res,
            List<RoomReservation> rooms, List<ClassroomReservation> classrooms,
            List<MealReservation> meals) {
        setStr(sheet, 5, 7, nvl(res.getOrganization())); // H6: 회사명
        setStr(sheet, 6, 7, nvl(res.getCompanyAddress())); // H7: 주소

        setStrWithNim(sheet, 7, 10, nvl(res.getCustomer())); // K8: 신청인 성명
        setStr(sheet, 7, 19, nvl(res.getCustomerPhone())); // T8: 신청인 연락처
        setStr(sheet, 7, 37, nvl(res.getCustomerEmail())); // AL8: 신청인 이메일

        setStrWithNim(sheet, 8, 10, nvl(res.getSiteManager())); // K9: 현장담당자 성명
        setStr(sheet, 8, 19, nvl(res.getSiteManagerPhone())); // T9: 현장담당자 연락처

        setStr(sheet, 11, 10, formatDateWithDay(res.getStartDate())); // K12: 입소일(요일)
        setStr(sheet, 11, 29, formatDateWithDay(res.getEndDate())); // AD12: 퇴소일(요일)
        setStr(sheet, 20, 13, formatDateWithDay(
                res.getStartDate() != null ? res.getStartDate().minusDays(4) : null)); // N21~X21

        fillConfirmationMeals(sheet, meals);
        fillConfirmationFacilities(sheet, rooms, classrooms);
    }

    private void fillConfirmationMeals(XSSFSheet sheet, List<MealReservation> meals) {
        // 식수현황: I16/O16/U16 날짜 + I17/O17/U17(조), I18/O18/U18(중), I19/O19/U19(석)
        List<LocalDate> dates = meals.stream().map(MealReservation::getMealDate).distinct().sorted()
                .limit(3).toList();
        int[] dateCols = {8, 14, 20}; // I, O, U

        for (int i = 0; i < dates.size(); i++) {
            LocalDate d = dates.get(i);
            int col = dateCols[i];
            setStr(sheet, 15, col, formatDayWithDay(d)); // row16: 16일(화)

            int breakfast = 0;
            int lunch = 0;
            int dinner = 0;
            for (MealReservation m : meals) {
                if (!d.equals(m.getMealDate()))
                    continue;
                breakfast += nvlInt(m.getBreakfast());
                lunch += nvlInt(m.getLunch());
                dinner += nvlInt(m.getDinner());
            }

            setLongNz(sheet, 16, col, breakfast); // row17 조
            setLongNz(sheet, 17, col, lunch); // row18 중
            setLongNz(sheet, 18, col, dinner); // row19 석
        }
    }

    private void fillConfirmationFacilities(XSSFSheet sheet, List<RoomReservation> rooms,
            List<ClassroomReservation> classrooms) {
        // 숙소: row23 STU(1인실), AC AD(2인실), AO AP(4인실)
        long onePersonRooms = rooms.stream()
                .filter(r -> "1인실".equals(ROOM_TYPE.getOrDefault(r.getRoomNumber(), "")))
                .map(RoomReservation::getRoomNumber).distinct().count();
        long twoPersonRooms = rooms.stream()
                .filter(r -> "2인실".equals(ROOM_TYPE.getOrDefault(r.getRoomNumber(), "")))
                .map(RoomReservation::getRoomNumber).distinct().count();
        long fourPersonRooms = rooms.stream()
                .filter(r -> "4인실".equals(ROOM_TYPE.getOrDefault(r.getRoomNumber(), "")))
                .map(RoomReservation::getRoomNumber).distinct().count();

        setLongNz(sheet, 22, 18, onePersonRooms); // S23
        setLongNz(sheet, 22, 28, twoPersonRooms); // AC23
        setLongNz(sheet, 22, 40, fourPersonRooms); // AO23

        // 강의실: row24 N~AS (여러 개면 콤마 구분)
        String classroomNames = classrooms.stream().map(ClassroomReservation::getClassroom)
                .distinct().sorted((a, b) -> {
                    boolean aNum = a.chars().allMatch(Character::isDigit);
                    boolean bNum = b.chars().allMatch(Character::isDigit);
                    if (aNum && bNum)
                        return Integer.compare(Integer.parseInt(a), Integer.parseInt(b));
                    if (aNum)
                        return -1;
                    if (bNum)
                        return 1;
                    return a.compareTo(b);
                }).map(this::formatClassroomLabel).distinct().collect(Collectors.joining(", "));
        setStr(sheet, 23, 13, classroomNames); // N24

        // 다목적실: row27 T~AD (A/B 사용 시 표시)
        String multipurpose = classrooms.stream().map(ClassroomReservation::getClassroom).distinct()
                .filter(c -> "A".equals(c) || "B".equals(c)).sorted()
                .collect(Collectors.joining(", "));
        setStr(sheet, 26, 19, multipurpose); // T27
    }

    private String formatDayWithDay(LocalDate date) {
        if (date == null)
            return "";
        String day = DAY_NAMES[date.getDayOfWeek().getValue() % 7];
        return date.getDayOfMonth() + "일(" + day + ")";
    }

    private String formatClassroomLabel(String classroom) {
        String category = CLASSROOM_CATEGORY.getOrDefault(classroom, "");
        if ("다목적실".equals(category))
            return "다목적실";

        int start = category.indexOf('(');
        int end = category.indexOf(')');
        String capacity = (start >= 0 && end > start) ? category.substring(start + 1, end) : "";

        if (capacity.isBlank()) {
            return classroom.chars().allMatch(Character::isDigit) ? classroom + "호" : classroom;
        }
        return capacity + "용(" + classroom + "호)";
    }

    private List<TradeItem> buildTradeItems(List<RoomReservation> rooms,
            List<ClassroomReservation> classrooms, Map<String, String> settings, long roomPrice) {

        List<TradeItem> items = new ArrayList<>();

        Map<String, List<RoomReservation>> byType = rooms.stream().collect(
                Collectors.groupingBy(r -> ROOM_TYPE.getOrDefault(r.getRoomNumber(), "4인실")));

        for (String type : ROOM_ORDER) {
            List<RoomReservation> typeRooms = byType.getOrDefault(type, List.of());
            if (typeRooms.isEmpty())
                continue;

            long nights =
                    typeRooms.stream().map(RoomReservation::getReservedDate).distinct().count();
            long count = typeRooms.stream().map(RoomReservation::getRoomNumber).distinct().count();
            long supply = nights * count * roomPrice;
            long tax = Math.round(supply * 0.1);

            items.add(new TradeItem("숙박비(" + type + ")", nights + "박", count, roomPrice, supply,
                    tax));
        }

        Map<String, List<ClassroomReservation>> byCategory = classrooms.stream()
                .filter(c -> CLASSROOM_CATEGORY.containsKey(c.getClassroom()))
                .collect(Collectors.groupingBy(c -> CLASSROOM_CATEGORY.get(c.getClassroom())));

        for (String cat : CLASSROOM_ORDER) {
            List<ClassroomReservation> catList = byCategory.getOrDefault(cat, List.of());
            if (catList.isEmpty())
                continue;

            long days =
                    catList.stream().map(ClassroomReservation::getReservedDate).distinct().count();
            long count =
                    catList.stream().map(ClassroomReservation::getClassroom).distinct().count();
            long price = toLong(settings.getOrDefault("price.classroom." + cat, "0"));
            long supply = days * count * price;
            long tax = Math.round(supply * 0.1);

            items.add(
                    new TradeItem(CATEGORY_LABEL.get(cat), days + "일", count, price, supply, tax));
        }

        return items;
    }

    private void ensureItemRows(XSSFSheet sheet, int needed) {
        for (int r = ITEM_START_ROW; r < ITEM_START_ROW + TEMPLATE_ITEM_ROWS; r++) {
            Row row = sheet.getRow(r);
            if (row == null)
                row = sheet.createRow(r);
            row.setZeroHeight(false);
        }

        if (needed <= TEMPLATE_ITEM_ROWS)
            return;

        int extra = needed - TEMPLATE_ITEM_ROWS;
        int shiftFrom = ITEM_START_ROW + TEMPLATE_ITEM_ROWS;
        int lastRow = sheet.getLastRowNum();
        sheet.shiftRows(shiftFrom, lastRow, extra);

        Row templateRow = sheet.getRow(ITEM_START_ROW);
        for (int i = 0; i < extra; i++) {
            Row newRow = sheet.createRow(shiftFrom + i);
            if (templateRow != null) {
                newRow.setHeight(templateRow.getHeight());
                for (int col = 1; col <= 31; col++) {
                    Cell src = templateRow.getCell(col);
                    Cell dst = newRow.createCell(col);
                    if (src != null)
                        dst.setCellStyle(src.getCellStyle());
                }
            }
        }
    }

    private void fillTradeHeader(XSSFSheet sheet, Reservation res, Map<String, String> settings) {
        setStr(sheet, 2, 2, formatDateWithDay(LocalDate.now())); // C3: 발행일
        setStr(sheet, 3, 1, res.getOrganization()); // B4: 업체명
        setStr(sheet, 3, 25, settings.getOrDefault("contact.representative", "")); // Z4: 성명
        setStr(sheet, 6, 6, nvl(res.getPurpose())); // G7: 교육명칭
        setStr(sheet, 7, 6, formatDateWithDay(res.getStartDate())); // G8: 시작일
        setStr(sheet, 7, 19, formatDateWithDay(res.getEndDate())); // T8: 종료일
    }

    private long[] fillTradeItems(XSSFSheet sheet, List<TradeItem> items, int kaeRow) {
        for (int r = ITEM_START_ROW; r < kaeRow; r++) {
            clearTradeItemRow(sheet, r);
        }

        long totalSupply = 0, totalTax = 0;

        for (int i = 0; i < items.size(); i++) {
            TradeItem item = items.get(i);
            int rowIdx = ITEM_START_ROW + i;

            setStr(sheet, rowIdx, 3, item.name());
            setStr(sheet, rowIdx, 10, item.spec());
            setLongNz(sheet, rowIdx, 13, item.qty());
            setLongNz(sheet, rowIdx, 16, item.unitPrice());
            setLongNz(sheet, rowIdx, 19, item.supply());
            setLongNz(sheet, rowIdx, 25, item.tax());

            totalSupply += item.supply();
            totalTax += item.tax();
        }

        for (int r = ITEM_START_ROW + items.size(); r < kaeRow; r++) {
            Row row = sheet.getRow(r);
            if (row == null)
                row = sheet.createRow(r);
            row.setZeroHeight(true);
        }

        return new long[] {totalSupply, totalTax};
    }

    private void fillTradeTotals(XSSFSheet sheet, long[] totals, int kaeRow) {
        long supply = totals[0];
        long tax = totals[1];
        long grand = supply + tax;

        setLongNz(sheet, kaeRow, 19, supply);
        setLongNz(sheet, kaeRow, 25, tax);
        setLongNz(sheet, kaeRow + 1, 19, grand);

        String formatted = "(₩" + NumberFormat.getNumberInstance(Locale.KOREA).format(grand) + "-)";
        setStr(sheet, 5, 1, formatted);
    }

    private void fillTradeContact(XSSFSheet sheet, Map<String, String> settings, int kaeRow) {
        int contactRow = kaeRow + 6;
        setStr(sheet, contactRow, 4, settings.getOrDefault("contact.manager", ""));
        setStr(sheet, contactRow, 11, settings.getOrDefault("contact.phone", ""));
        setStr(sheet, contactRow, 18, settings.getOrDefault("contact.fax", ""));
        setStr(sheet, contactRow, 25, settings.getOrDefault("contact.email", ""));
    }

    private int findKaeRow(XSSFSheet sheet) {
        for (int r = ITEM_START_ROW; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null)
                continue;
            Cell cell = row.getCell(1);
            if (cell != null && CellType.STRING.equals(cell.getCellType())
                    && "계".equals(cell.getStringCellValue().trim())) {
                return r;
            }
        }
        return ITEM_START_ROW + TEMPLATE_ITEM_ROWS;
    }

    private void clearTradeItemRow(XSSFSheet sheet, int rowIdx) {
        Row row = sheet.getRow(rowIdx);
        if (row == null)
            return;
        for (int col : new int[] {3, 10, 13, 16, 19, 25}) {
            Cell cell = row.getCell(col);
            if (cell != null)
                cell.setBlank();
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 전체 내보내기 (exportAll)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * 모든 예약 데이터를 4개 시트 xlsx로 변환하여 byte[] 반환.
     */
    @Override
    @Transactional(readOnly = true)
    public byte[] exportAll(String userId) {
        List<Reservation> reservations = reservationRepository.findAll();
        List<RoomReservation> rooms = roomReservationRepository.findAll();
        List<ClassroomReservation> classrooms = classroomReservationRepository.findAll();
        List<MealReservation> meals = mealReservationRepository.findAll();

        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            CellStyle headerStyle = makeHeaderStyle(wb);

            writeReservationSheet(wb, headerStyle, reservations);
            writeRoomSheet(wb, headerStyle, rooms);
            writeClassroomSheet(wb, headerStyle, classrooms);
            writeMealSheet(wb, headerStyle, meals);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();

        } catch (IOException e) {
            log.error("데이터 내보내기 실패 요청자={}", userId ,e);
            throw new RuntimeException("엑셀 생성 중 오류가 발생했습니다.");
        }
    }

    private void writeReservationSheet(XSSFWorkbook wb, CellStyle headerStyle,
            List<Reservation> list) {
        XSSFSheet sheet = wb.createSheet("예약정보");
        String[] headers = {"예약코드", "단체명", "목적", "인원수", "담당자", "연락처1", "연락처2", "이메일", "시작일", "종료일",
                "컬러코드", "상태", "주소", "현장담당자", "현장연락처", "메모"};
        writeHeader(sheet, headerStyle, headers);

        int rowNum = 1;
        for (Reservation r : list) {
            Row row = sheet.createRow(rowNum++);
            int col = 0;
            setExportCell(row, col++, r.getReservationCode());
            setExportCell(row, col++, r.getOrganization());
            setExportCell(row, col++, r.getPurpose());
            setExportCell(row, col++, r.getPeople() != null ? r.getPeople() : 0);
            setExportCell(row, col++, r.getCustomer());
            setExportCell(row, col++, r.getCustomerPhone());
            setExportCell(row, col++, r.getCustomerPhone2());
            setExportCell(row, col++, r.getCustomerEmail());
            setExportCell(row, col++, r.getStartDate());
            setExportCell(row, col++, r.getEndDate());
            setExportCell(row, col++, r.getColorCode());
            setExportCell(row, col++, r.getStatus());
            setExportCell(row, col++, r.getCompanyAddress());
            setExportCell(row, col++, r.getSiteManager());
            setExportCell(row, col++, r.getSiteManagerPhone());
            setExportCell(row, col++, r.getMemo());
        }
        autoSizeColumns(sheet, headers.length);
    }

    private void writeRoomSheet(XSSFWorkbook wb, CellStyle headerStyle,
            List<RoomReservation> list) {
        XSSFSheet sheet = wb.createSheet("숙박예약");
        String[] headers = {"예약코드", "호실", "날짜"};
        writeHeader(sheet, headerStyle, headers);

        int rowNum = 1;
        for (RoomReservation r : list) {
            Row row = sheet.createRow(rowNum++);
            setExportCell(row, 0, r.getReservation().getReservationCode());
            setExportCell(row, 1, r.getRoomNumber());
            setExportCell(row, 2, r.getReservedDate());
        }
        autoSizeColumns(sheet, headers.length);
    }

    private void writeClassroomSheet(XSSFWorkbook wb, CellStyle headerStyle,
            List<ClassroomReservation> list) {
        XSSFSheet sheet = wb.createSheet("강의실예약");
        String[] headers = {"예약코드", "강의실", "날짜"};
        writeHeader(sheet, headerStyle, headers);

        int rowNum = 1;
        for (ClassroomReservation c : list) {
            Row row = sheet.createRow(rowNum++);
            setExportCell(row, 0, c.getReservation().getReservationCode());
            setExportCell(row, 1, c.getClassroom());
            setExportCell(row, 2, c.getReservedDate());
        }
        autoSizeColumns(sheet, headers.length);
    }

    private void writeMealSheet(XSSFWorkbook wb, CellStyle headerStyle,
            List<MealReservation> list) {
        XSSFSheet sheet = wb.createSheet("식수예약");
        String[] headers = {"예약코드", "날짜", "조식", "중식", "석식", "특별조식", "특별중식", "특별석식"};
        writeHeader(sheet, headerStyle, headers);

        int rowNum = 1;
        for (MealReservation m : list) {
            Row row = sheet.createRow(rowNum++);
            int col = 0;
            setExportCell(row, col++, m.getReservation().getReservationCode());
            setExportCell(row, col++, m.getMealDate());
            setExportCell(row, col++, m.getBreakfast() != null ? m.getBreakfast() : 0);
            setExportCell(row, col++, m.getLunch() != null ? m.getLunch() : 0);
            setExportCell(row, col++, m.getDinner() != null ? m.getDinner() : 0);
            setExportCell(row, col++, m.isSpecialBreakfast() ? "Y" : "N");
            setExportCell(row, col++, m.isSpecialLunch() ? "Y" : "N");
            setExportCell(row, col++, m.isSpecialDinner() ? "Y" : "N");
        }
        autoSizeColumns(sheet, headers.length);
    }

    private void writeHeader(XSSFSheet sheet, CellStyle style, String[] headers) {
        Row row = sheet.createRow(0);
        for (int i = 0; i < headers.length; i++) {
            Cell cell = row.createCell(i);
            cell.setCellValue(headers[i]);
            cell.setCellStyle(style);
        }
    }

    private CellStyle makeHeaderStyle(XSSFWorkbook wb) {
        CellStyle style = wb.createCellStyle();
        style.setFillForegroundColor(IndexedColors.CORNFLOWER_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);

        Font font = wb.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private void setExportCell(Row row, int col, String value) {
        row.createCell(col).setCellValue(value != null ? value : "");
    }

    private void setExportCell(Row row, int col, int value) {
        row.createCell(col).setCellValue(value);
    }

    private void setExportCell(Row row, int col, LocalDate date) {
        row.createCell(col).setCellValue(date != null ? date.toString() : "");
    }

    private void autoSizeColumns(XSSFSheet sheet, int count) {
        for (int i = 0; i < count; i++) {
            sheet.autoSizeColumn(i);
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 전체 가져오기 (importAll)
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * xlsx 파일을 읽어 예약 데이터를 일괄 등록/수정합니다.
     */
    @Override
    @Transactional
    public ImportResult importAll(MultipartFile file) {

        int created = 0, updated = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        try (XSSFWorkbook wb = new XSSFWorkbook(file.getInputStream())) {

            Map<String, Reservation> codeMap = new LinkedHashMap<>();

            XSSFSheet resSheet = wb.getSheet("예약정보");
            if (resSheet == null) {
                throw new IllegalArgumentException("'예약정보' 시트를 찾을 수 없습니다.");
            }

            for (int i = 1; i <= resSheet.getLastRowNum(); i++) {
                Row row = resSheet.getRow(i);
                if (row == null)
                    continue;

                try {
                    String code = importStr(row, 0);
                    if (code.isBlank())
                        continue;

                    String organization = importStr(row, 1);
                    String purpose = importStr(row, 2);
                    int people = (int) importNum(row, 3);
                    String customer = importStr(row, 4);
                    String phone1 = importStr(row, 5);
                    String phone2 = importStr(row, 6);
                    String email = importStr(row, 7);
                    LocalDate startDate = importDate(importStr(row, 8));
                    LocalDate endDate = importDate(importStr(row, 9));
                    String colorCode = importStr(row, 10);
                    String status = importStr(row, 11);
                    String address = importStr(row, 12);
                    String siteManager = importStr(row, 13);
                    String sitePhone = importStr(row, 14);
                    String memo = importStr(row, 15);

                    Reservation res =
                            reservationRepository.findByReservationCode(code).orElse(null);

                    if (res != null) {
                        res.updateFromImport(organization, purpose, people, customer, phone1,
                                phone2, email, startDate, endDate, colorCode, status, address,
                                siteManager, sitePhone, memo);
                        updated++;
                    } else {
                        res = reservationRepository.save(Reservation.fromImport(code, organization,
                                purpose, people, customer, phone1, phone2, email, startDate,
                                endDate, colorCode, status, address, siteManager, sitePhone, memo));
                        created++;
                    }

                    codeMap.put(code, res);

                } catch (Exception e) {
                    failed++;
                    errors.add("예약정보 " + (i + 1) + "행: " + e.getMessage());
                    log.warn("예약정보 {}행 처리 실패: {}", i + 1, e.getMessage());
                }
            }

            for (Reservation res : codeMap.values()) {
                roomReservationRepository.deleteByReservation(res);
                classroomReservationRepository.deleteByReservation(res);
                mealReservationRepository.deleteByReservation(res);
            }

            XSSFSheet roomSheet = wb.getSheet("숙박예약");
            if (roomSheet != null) {
                for (int i = 1; i <= roomSheet.getLastRowNum(); i++) {
                    Row row = roomSheet.getRow(i);
                    if (row == null)
                        continue;
                    try {
                        Reservation res = codeMap.get(importStr(row, 0));
                        if (res == null)
                            continue;
                        roomReservationRepository.save(RoomReservation.of(res, importStr(row, 1),
                                importDate(importStr(row, 2))));
                    } catch (Exception e) {
                        errors.add("숙박예약 " + (i + 1) + "행: " + e.getMessage());
                    }
                }
            }

            XSSFSheet classSheet = wb.getSheet("강의실예약");
            if (classSheet != null) {
                for (int i = 1; i <= classSheet.getLastRowNum(); i++) {
                    Row row = classSheet.getRow(i);
                    if (row == null)
                        continue;
                    try {
                        Reservation res = codeMap.get(importStr(row, 0));
                        if (res == null)
                            continue;
                        classroomReservationRepository.save(ClassroomReservation.builder()
                                .reservation(res).classroom(importStr(row, 1))
                                .reservedDate(importDate(importStr(row, 2))).build());
                    } catch (Exception e) {
                        errors.add("강의실예약 " + (i + 1) + "행: " + e.getMessage());
                    }
                }
            }

            XSSFSheet mealSheet = wb.getSheet("식수예약");
            if (mealSheet != null) {
                for (int i = 1; i <= mealSheet.getLastRowNum(); i++) {
                    Row row = mealSheet.getRow(i);
                    if (row == null)
                        continue;
                    try {
                        Reservation res = codeMap.get(importStr(row, 0));
                        if (res == null)
                            continue;
                        mealReservationRepository.save(MealReservation.builder().reservation(res)
                                .mealDate(importDate(importStr(row, 1)))
                                .breakfast((int) importNum(row, 2)).lunch((int) importNum(row, 3))
                                .dinner((int) importNum(row, 4))
                                .specialBreakfast("Y".equalsIgnoreCase(importStr(row, 5)))
                                .specialLunch("Y".equalsIgnoreCase(importStr(row, 6)))
                                .specialDinner("Y".equalsIgnoreCase(importStr(row, 7))).build());
                    } catch (Exception e) {
                        errors.add("식수예약 " + (i + 1) + "행: " + e.getMessage());
                    }
                }
            }

        } catch (IOException e) {
            log.error("Excel import 실패", e);
            throw new RuntimeException("엑셀 파일을 읽는 중 오류가 발생했습니다.");
        }

        log.info("Excel import 완료 — created:{} updated:{} failed:{}", created, updated, failed);
        return ImportResult.of(created, updated, failed, errors);
    }

    // ── import 전용 셀 읽기 유틸 ──────────────────────────────────────────────

    private String importStr(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null)
            return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double v = cell.getNumericCellValue();
                yield v == Math.floor(v) ? String.valueOf((long) v) : String.valueOf(v);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            default -> "";
        };
    }

    private double importNum(Row row, int col) {
        Cell cell = row.getCell(col);
        if (cell == null)
            return 0;
        return switch (cell.getCellType()) {
            case NUMERIC -> cell.getNumericCellValue();
            case STRING -> {
                String s = cell.getStringCellValue().trim();
                yield s.isEmpty() ? 0 : Double.parseDouble(s);
            }
            default -> 0;
        };
    }

    private LocalDate importDate(String s) {
        if (s == null || s.isBlank())
            throw new IllegalArgumentException("날짜 값이 비어있습니다.");
        return LocalDate.parse(s.trim());
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 공통 셀 접근 유틸
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * 이미 있는 셀은 기존 스타일을 유지하면서 값만 교체. 수식 셀은 스타일을 보존하며 일반 셀로 교체합니다.
     */
    private Cell getOrCreate(XSSFSheet sheet, int rowIdx, int colIdx) {
        Row row = sheet.getRow(rowIdx);
        if (row == null)
            row = sheet.createRow(rowIdx);
        Cell cell = row.getCell(colIdx);
        if (cell == null)
            return row.createCell(colIdx);
        if (CellType.FORMULA.equals(cell.getCellType())) {
            org.apache.poi.ss.usermodel.CellStyle style = cell.getCellStyle();
            row.removeCell(cell);
            cell = row.createCell(colIdx);
            cell.setCellStyle(style);
        }
        return cell;
    }

    private void setStr(XSSFSheet sheet, int row, int col, String value) {
        getOrCreate(sheet, row, col).setCellValue(value != null ? value : "");
    }

    /** 이름 뒤에 "님"을 붙이고, 셀 폰트를 1pt 줄여 잘림을 방지 */
    private void setStrWithNim(XSSFSheet sheet, int rowIdx, int colIdx, String name) {
        String value = (name != null && !name.isEmpty()) ? (name.endsWith("님") ? name : name + "님") : "";
        Cell cell = getOrCreate(sheet, rowIdx, colIdx);
        cell.setCellValue(value);
        if (value.isEmpty())
            return;

        XSSFWorkbook wb = sheet.getWorkbook();
        XSSFCellStyle existingStyle = (XSSFCellStyle) cell.getCellStyle();
        XSSFFont existingFont = existingStyle.getFont();

        XSSFCellStyle newStyle = wb.createCellStyle();
        newStyle.cloneStyleFrom(existingStyle);

        XSSFFont newFont = wb.createFont();
        newFont.setFontName(existingFont.getFontName());
        newFont.setBold(existingFont.getBold());
        newFont.setItalic(existingFont.getItalic());
        newFont.setFontHeightInPoints((short) (existingFont.getFontHeightInPoints() - 1));
        newStyle.setFont(newFont);
        cell.setCellStyle(newStyle);
    }

    private void setLong(XSSFSheet sheet, int row, int col, long value) {
        getOrCreate(sheet, row, col).setCellValue((double) value);
    }

    /** 0이면 쓰지 않음 */
    private void setLongNz(XSSFSheet sheet, int row, int col, long value) {
        if (value == 0)
            return;
        getOrCreate(sheet, row, col).setCellValue((double) value);
    }

    /** 0이면 "-" 문자열, 아니면 숫자 */
    private void setLongOrDash(XSSFSheet sheet, int row, int col, long value) {
        if (value == 0)
            setStr(sheet, row, col, "-");
        else
            setLong(sheet, row, col, value);
    }

    /** 셀을 blank로 만들기 (formula 포함 제거) */
    private void blankCell(XSSFSheet sheet, int rowIdx, int colIdx) {
        Row row = sheet.getRow(rowIdx);
        if (row == null)
            return;
        Cell cell = row.getCell(colIdx);
        if (cell != null)
            cell.setBlank();
    }

    /** LocalDate → "yyyy년 MM월 dd일" 형식 문자열 설정 */
    private void setDate(XSSFSheet sheet, int row, int col, LocalDate date) {
        if (date == null)
            return;
        getOrCreate(sheet, row, col).setCellValue(formatDate(date));
    }

    private String formatDate(LocalDate date) {
        if (date == null)
            return "";
        return date.getYear() + "년 " + String.format("%02d", date.getMonthValue()) + "월 "
                + String.format("%02d", date.getDayOfMonth()) + "일";
    }

    private static final String[] DAY_NAMES = {"일", "월", "화", "수", "목", "금", "토"};

    private String formatDateWithDay(LocalDate date) {
        if (date == null)
            return "";
        String day = DAY_NAMES[date.getDayOfWeek().getValue() % 7];
        return formatDate(date) + " (" + day + ")";
    }

    private long toLong(String s) {
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private int nvlInt(Integer v) {
        return v != null ? v : 0;
    }

    private String nvl(String v) {
        return v != null ? v : "";
    }
}
