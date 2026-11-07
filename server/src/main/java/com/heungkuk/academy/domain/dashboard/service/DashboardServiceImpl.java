package com.heungkuk.academy.domain.dashboard.service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.heungkuk.academy.domain.dashboard.dto.response.DashboardResponse;
import com.heungkuk.academy.domain.dashboard.dto.response.DashboardResponse.KpiSection;
import com.heungkuk.academy.domain.dashboard.dto.response.DashboardResponse.MonthlyItem;
import com.heungkuk.academy.domain.dashboard.dto.response.DashboardResponse.RecentSurveyItem;
import com.heungkuk.academy.domain.dashboard.dto.response.DashboardResponse.SatisfactionSection;
import com.heungkuk.academy.domain.dashboard.dto.response.DashboardResponse.TodayClassroomItem;
import com.heungkuk.academy.domain.reservation.repository.ClassroomReservationRepository;
import com.heungkuk.academy.domain.reservation.repository.ReservationRepository;
import com.heungkuk.academy.domain.survey.repository.SurveyRepository;
import com.heungkuk.academy.domain.survey.repository.SurveyRepository.SatisfactionStats;
import lombok.RequiredArgsConstructor;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DashboardServiceImpl implements DashboardService {

    private final ReservationRepository reservationRepository;
    private final ClassroomReservationRepository classroomReservationRepository;
    private final SurveyRepository surveyRepository;

    @Override
    public DashboardResponse getDashboard() {
        LocalDate today = LocalDate.now();
        int year = today.getYear();
        int month = today.getMonthValue();

        return DashboardResponse.builder()
                .kpi(buildKpi(today, year, month))
                .todayClassrooms(buildTodayClassrooms(today))
                .monthlyData(buildMonthlyData(year))
                .satisfaction(buildSatisfaction())
                .recentSurveys(buildRecentSurveys())
                .build();
    }

    private KpiSection buildKpi(LocalDate today, int year, int month) {
        long thisMonth = reservationRepository.countByYearMonth(year, month);
        int prevMonth = month == 1 ? 12 : month - 1;
        int prevYear  = month == 1 ? year - 1 : year;
        long lastMonth = reservationRepository.countByYearMonth(prevYear, prevMonth);

        long todayCheckIn = reservationRepository.findTodayCheckIns(today).size();
        long todayPeople  = Optional.ofNullable(reservationRepository.sumPeopleForToday(today)).orElse(0L);

        SatisfactionStats stats = surveyRepository.getSatisfactionStats();
        double avg = 0;
        long count = stats.getTotal() != null ? stats.getTotal() : 0;
        if (count > 0) {
            // 응답이 하나도 없는 항목(예: 식당 전원 '이용 안함')은 0점이 아니라 제외하고 평균낸다
            double[] items = {
                    safeAvg(stats.getStaffService()), safeAvg(stats.getCleanliness()),
                    safeAvg(stats.getFacilities()), safeAvg(stats.getCafeteria()),
                    safeAvg(stats.getPricing())};
            double sum = 0;
            int answered = 0;
            for (double v : items) {
                if (v > 0) {
                    sum += v;
                    answered++;
                }
            }
            avg = answered > 0 ? Math.round((sum / answered) * 10.0) / 10.0 : 0;
        }

        return KpiSection.builder()
                .monthlyReservations(thisMonth)
                .monthlyChange(thisMonth - lastMonth)
                .todayCheckIn(todayCheckIn)
                .todayPeople(todayPeople)
                .surveyScore(avg)
                .surveyCount(count)
                .build();
    }

    private List<TodayClassroomItem> buildTodayClassrooms(LocalDate today) {
        return classroomReservationRepository.findTodayClassrooms(today).stream()
                .map(c -> TodayClassroomItem.builder()
                        .reservationId(c.getReservation().getId())
                        .classroom(c.getClassroom())
                        .organization(c.getReservation().getOrganization())
                        .purpose(c.getReservation().getPurpose())
                        .people(c.getReservation().getPeople())
                        .build())
                .toList();
    }

    private List<MonthlyItem> buildMonthlyData(int year) {
        Map<Integer, Long> monthMap = reservationRepository.countByMonthInYear(year).stream()
                .collect(Collectors.toMap(
                        row -> ((Number) row[0]).intValue(),
                        row -> ((Number) row[1]).longValue()));

        List<MonthlyItem> result = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            result.add(MonthlyItem.builder()
                    .month(m)
                    .count(monthMap.getOrDefault(m, 0L))
                    .build());
        }
        return result;
    }

    private SatisfactionSection buildSatisfaction() {
        SatisfactionStats stats = surveyRepository.getSatisfactionStats();
        return SatisfactionSection.builder()
                .staffService(safeAvg(stats.getStaffService()))
                .cleanliness(safeAvg(stats.getCleanliness()))
                .facilities(safeAvg(stats.getFacilities()))
                .cafeteria(safeAvg(stats.getCafeteria()))
                .pricing(safeAvg(stats.getPricing()))
                .totalCount(stats.getTotal() != null ? stats.getTotal() : 0)
                .build();
    }

    private List<RecentSurveyItem> buildRecentSurveys() {
        return surveyRepository.findRecentActiveReservationSurveys(PageRequest.of(0, 5)).stream()
                .map(s -> {
                    var token = s.getSurveyToken();
                    var res = token != null
                            ? reservationRepository.findByReservationCode(token.getReservationId()).orElse(null)
                            : null;
                    return RecentSurveyItem.builder()
                            .id(s.getId())
                            .organization(res != null ? res.getOrganization() : null)
                            .customer(res != null ? res.getCustomer() : null)
                            .startDate(res != null ? res.getStartDate() : null)
                            .endDate(res != null ? res.getEndDate() : null)
                            .colorCode(res != null ? res.getColorCode() : null)
                            .staffService(safeInt(s.getStaffService()))
                            .cleanliness(safeInt(s.getCleanliness()))
                            .facilities(safeInt(s.getFacilities()))
                            .cafeteria(safeInt(s.getCafeteria()))
                            .pricing(safeInt(s.getPricing()))
                            .revisit(s.getRevisit())
                            .createdAt(s.getCreatedAt())
                            .build();
                })
                .toList();
    }

    private double safeAvg(Double val) {
        return val != null ? Math.round(val * 10.0) / 10.0 : 0.0;
    }

    private int safeInt(Integer val) {
        return val != null ? val : 0;
    }
}
