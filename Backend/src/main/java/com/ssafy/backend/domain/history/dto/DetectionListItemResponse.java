package com.ssafy.backend.domain.history.dto;

import com.ssafy.backend.domain.history.domain.Detection;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
@Schema(description = "탐지 목록 항목 응답 DTO")
public class DetectionListItemResponse {

    @Schema(description = "감지 ID")
    private Long id;

    @Schema(description = "감지된 객체 라벨")
    private String label;

    @Schema(description = "확신도 (0.0 ~ 1.0)")
    private float confidence;

    @Schema(description = "X 좌표")
    private BigDecimal x;

    @Schema(description = "Y 좌표")
    private BigDecimal y;

    @Schema(description = "이미지 접근 경로 (API 리다이렉트 경로)")
    private String imageUrl;

    @Schema(description = "생성 일시")
    private LocalDateTime createdAt;

    public static DetectionListItemResponse from(Detection detection) {
        return DetectionListItemResponse.builder()
                .id(detection.getId())
                .label(detection.getLabel())
                .confidence(detection.getConfidence())
                .x(detection.getX())
                .y(detection.getY())
                // 목록에서는 리다이렉트 API 경로만 제공 (/api/detections/{id}/image)
                .imageUrl("/api/detections/" + detection.getId() + "/image")
                .createdAt(detection.getCreatedAt())
                .build();
    }
}
