package com.ssafy.backend.domain.history.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class DetectionStatisticsResponse {
    private String label;
    private Long count;
}
