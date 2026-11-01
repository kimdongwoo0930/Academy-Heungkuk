package com.heungkuk.academy.domain.reservation.entity;

import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import com.heungkuk.academy.domain.reservation.dto.request.ReservationRequest;
import com.heungkuk.academy.global.entity.BaseTimeEntity;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Builder
@Entity
@Table(name = "reservation", indexes = {
        @Index(name = "idx_reservation_dates", columnList = "start_date, end_date")
})
public class Reservation extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 예약번호 (자동 생성, 예: HK-20260316-001). PK(id)와 별개이며, 설문 토큰 등 외부 참조에 사용 */
    @Column(name = "reservation_code", length = 20, unique = true, nullable = false)
    private String reservationCode;

    /** 단체명 */
    @Column(length = 100, nullable = false)
    private String organization;

    /** 교육명 / 사용 목적 */
    @Column(length = 255, nullable = false)
    private String purpose;

    /** 교육 인원수 */
    @Column(name = "인원수")
    private Integer people;

    /** 신청인 이름 */
    @Column(length = 50, nullable = false)
    private String customer;

    /** 신청인 연락처 */
    @Column(name = "customer_phone", length = 20, nullable = false)
    private String customerPhone;

    /** 신청인 연락처2 (선택) */
    @Column(name = "customer_phone2", length = 20)
    private String customerPhone2;

    /** 신청인 이메일 */
    @Column(name = "customer_email", length = 100, nullable = false)
    private String customerEmail;

    /** 입실일 */
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** 퇴실일 */
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    /** 일정표 표시 색상 코드 (예: #4A90E2) */
    @Column(name = "color_code", length = 10, nullable = false)
    private String colorCode;

    // ── 단체 추가 정보 (선택) ──────────────────────────────────────────

    /** 업체 우편번호 */
    @Column(name = "company_zip_code", length = 10)
    private String companyZipCode;

    /** 업체 도로명 주소 */
    @Column(name = "company_address", length = 255)
    private String companyAddress;

    /** 사업자등록번호 */
    @Column(name = "business_number", length = 20)
    private String businessNumber;

    /** 대표이사명 */
    @Column(name = "ceo_name", length = 50)
    private String ceoName;

    // ── 현장 담당자 (선택) ────────────────────────────────────────────

    /** 현장 담당자 이름 */
    @Column(name = "site_manager", length = 50)
    private String siteManager;

    /** 현장 담당자 연락처 */
    @Column(name = "site_manager_phone", length = 20)
    private String siteManagerPhone;

    /** 현장 담당자 연락처2 */
    @Column(name = "site_manager_phone2", length = 20)
    private String siteManagerPhone2;

    /** 현장 담당자 이메일 */
    @Column(name = "site_manager_email", length = 100)
    private String siteManagerEmail;

    // ── 정산 담당자 (선택) ────────────────────────────────────────────

    /** 정산 담당자 이름 */
    @Column(name = "billing_manager", length = 50)
    private String billingManager;

    /** 정산 담당자 연락처 */
    @Column(name = "billing_manager_phone", length = 20)
    private String billingManagerPhone;

    /** 정산 담당자 이메일 */
    @Column(name = "billing_manager_email", length = 100)
    private String billingManagerEmail;

    // ─────────────────────────────────────────────────────────────────

    /** 예약 상태 (확정 / 예약 / 문의 / 취소) */
    @Column(length = 20, nullable = false)
    private String status;

    /** 정산 방법 (미정 / 카드 / 세금계산서 / 계산서) */
    @Column(name = "payment_method", length = 20)
    private String paymentMethod;

    /** 메모 */
    @Column(columnDefinition = "TEXT")
    private String memo;

    public static Reservation from(ReservationRequest request, String reservationCode) {
        return Reservation.builder().reservationCode(reservationCode)
                .organization(request.getOrganization()).purpose(request.getPurpose())
                .people(request.getPeople()).customer(request.getCustomer())
                .customerPhone(request.getCustomerPhone())
                .customerPhone2(request.getCustomerPhone2())
                .customerEmail(request.getCustomerEmail()).startDate(request.getStartDate())
                .endDate(request.getEndDate()).colorCode(request.getColorCode())
                .status(request.getStatus())
                .companyZipCode(request.getCompanyZipCode())
                .companyAddress(request.getCompanyAddress())
                .businessNumber(request.getBusinessNumber())
                .ceoName(request.getCeoName())
                .siteManager(request.getSiteManager())
                .siteManagerPhone(request.getSiteManagerPhone())
                .siteManagerPhone2(request.getSiteManagerPhone2())
                .siteManagerEmail(request.getSiteManagerEmail())
                .billingManager(request.getBillingManager())
                .billingManagerPhone(request.getBillingManagerPhone())
                .billingManagerEmail(request.getBillingManagerEmail())
                .paymentMethod(request.getPaymentMethod())
                .memo(request.getMemo()).build();
    }

    public void update(ReservationRequest request) {
        this.organization = request.getOrganization();
        this.purpose = request.getPurpose();
        this.people = request.getPeople();
        this.customer = request.getCustomer();
        this.customerPhone = request.getCustomerPhone();
        this.customerPhone2 = request.getCustomerPhone2();
        this.customerEmail = request.getCustomerEmail();
        this.startDate = request.getStartDate();
        this.endDate = request.getEndDate();
        this.colorCode = request.getColorCode();
        this.status = request.getStatus();
        this.companyZipCode = request.getCompanyZipCode();
        this.companyAddress = request.getCompanyAddress();
        this.businessNumber = request.getBusinessNumber();
        this.ceoName = request.getCeoName();
        this.siteManager = request.getSiteManager();
        this.siteManagerPhone = request.getSiteManagerPhone();
        this.siteManagerPhone2 = request.getSiteManagerPhone2();
        this.siteManagerEmail = request.getSiteManagerEmail();
        this.billingManager = request.getBillingManager();
        this.billingManagerPhone = request.getBillingManagerPhone();
        this.billingManagerEmail = request.getBillingManagerEmail();
        this.paymentMethod = request.getPaymentMethod();
        this.memo = request.getMemo();
    }

    public void updateStatus(String status) {
        this.status = status;
    }

    /** Excel import 전용 — reservation_code가 없는 신규 행 생성 */
    public static Reservation fromImport(String code, String organization, String purpose,
            Integer people, String customer, String customerPhone, String customerPhone2,
            String customerEmail, LocalDate startDate, LocalDate endDate,
            String colorCode, String status, String companyAddress,
            String siteManager, String siteManagerPhone, String memo) {
        return Reservation.builder().reservationCode(code).organization(organization)
                .purpose(purpose).people(people).customer(customer)
                .customerPhone(customerPhone)
                .customerPhone2(customerPhone2 != null && customerPhone2.isBlank() ? null : customerPhone2)
                .customerEmail(customerEmail).startDate(startDate).endDate(endDate)
                .colorCode(colorCode).status(status)
                .companyAddress(companyAddress != null && companyAddress.isBlank() ? null : companyAddress)
                .siteManager(siteManager != null && siteManager.isBlank() ? null : siteManager)
                .siteManagerPhone(siteManagerPhone != null && siteManagerPhone.isBlank() ? null : siteManagerPhone)
                .memo(memo != null && memo.isBlank() ? null : memo).build();
    }

    /** Excel import 전용 — 기존 예약 필드 업데이트 */
    public void updateFromImport(String organization, String purpose, Integer people,
            String customer, String customerPhone, String customerPhone2, String customerEmail,
            LocalDate startDate, LocalDate endDate, String colorCode, String status,
            String companyAddress, String siteManager, String siteManagerPhone, String memo) {
        this.organization = organization;
        this.purpose = purpose;
        this.people = people;
        this.customer = customer;
        this.customerPhone = customerPhone;
        this.customerPhone2 = customerPhone2 != null && customerPhone2.isBlank() ? null : customerPhone2;
        this.customerEmail = customerEmail;
        this.startDate = startDate;
        this.endDate = endDate;
        this.colorCode = colorCode;
        this.status = status;
        this.companyAddress = companyAddress != null && companyAddress.isBlank() ? null : companyAddress;
        this.siteManager = siteManager != null && siteManager.isBlank() ? null : siteManager;
        this.siteManagerPhone = siteManagerPhone != null && siteManagerPhone.isBlank() ? null : siteManagerPhone;
        this.memo = memo != null && memo.isBlank() ? null : memo;
    }
}
