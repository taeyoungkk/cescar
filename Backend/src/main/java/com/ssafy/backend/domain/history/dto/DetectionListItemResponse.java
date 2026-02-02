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
        String imageUrl = detection.getImageUrl();
        String resolvedImageUrl = isAbsoluteUrl(imageUrl)
                ? imageUrl
                : "/api/detections/" + detection.getId() + "/image";
        return DetectionListItemResponse.builder()
                .id(detection.getId())
                .label(detection.getLabel())
                .confidence(detection.getConfidence())
                .x(detection.getX())
                .y(detection.getY())
                // 목록에서는 절대 URL이면 그대로, 아니면 리다이렉트 API 경로 제공
                .imageUrl(resolvedImageUrl)
                .createdAt(detection.getCreatedAt())
                .build();
    }

    private static boolean isAbsoluteUrl(String value) {
        if (value == null) {
            return false;
        }
        return value.startsWith("http://") || value.startsWith("https://");
    }
}
