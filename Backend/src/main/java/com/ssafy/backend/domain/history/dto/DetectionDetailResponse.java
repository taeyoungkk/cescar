package com.ssafy.backend.domain.history.dto;

import com.ssafy.backend.domain.history.domain.Detection;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
@Schema(description = "탐지 상세 정보 응답 DTO")
public class DetectionDetailResponse {

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

    @Schema(description = "좌표 보유 여부")
    private boolean hasLocation;

    @Schema(description = "이미지 접근 경로 (API 리다이렉트 경로)")
    private String imageUrl;

    @Schema(description = "비디오 접근 경로 (API 리다이렉트 경로, 없을 수 있음)")
    private String videoUrl;

    @Schema(description = "생성 일시")
    private LocalDateTime createdAt;

    public static DetectionDetailResponse from(Detection detection) {
        String imageUrl = detection.getImageUrl();
        String videoUrl = detection.getVideoUrl();
        String resolvedImageUrl = isAbsoluteUrl(imageUrl)
                ? imageUrl
                : "/api/detections/" + detection.getId() + "/image";
        String resolvedVideoUrl = null;
        if (videoUrl != null && !videoUrl.isEmpty()) {
            resolvedVideoUrl = isAbsoluteUrl(videoUrl)
                    ? videoUrl
                    : "/api/detections/" + detection.getId() + "/video";
        }

        return DetectionDetailResponse.builder()
                .id(detection.getId())
                .label(detection.getLabel())
                .confidence(detection.getConfidence())
                .x(detection.getX())
                .y(detection.getY())
                .hasLocation(detection.getX() != null && detection.getY() != null)
                .imageUrl(resolvedImageUrl)
                .videoUrl(resolvedVideoUrl)
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
