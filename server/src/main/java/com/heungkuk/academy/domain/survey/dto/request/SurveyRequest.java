package com.heungkuk.academy.domain.survey.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class SurveyRequest {

    private String location;
    private String locationEtc;

    private String industry;
    private String industryEtc;

    private String purpose;
    private String purposeEtc;

    private String visitRoute;
    private String visitRouteEtc;

    @Min(0) @Max(5)
    private Integer staffService;
    private String staffServiceComment;

    @Min(0) @Max(5)
    private Integer cleanliness;
    private String cleanlinessComment;

    @Min(0) @Max(5)
    private Integer facilities;
    private String facilitiesComment;

    @Min(0) @Max(5)
    private Integer cafeteria;
    private String cafeteriaComment;

    @Min(0) @Max(5)
    private Integer pricing;
    private String pricingComment;

    private String revisit;
    private String revisitComment;

    private String comment;
}
