package com.ssafy.backend.domain.map.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class SlamMapRequest {

    /**
     * 지도 등록 요청 (POST /api/cars/{carId}/maps)
     */
    public record CreateRequest(
            @NotBlank(message = "지도 이름은 필수입니다.") String name,
            @NotBlank(message = "지도 이미지 URL은 필수입니다.") String imageUrl,
            @Min(value = 1, message = "지도 너비는 1 이상이어야 합니다.") int width,
            @Min(value = 1, message = "지도 높이는 1 이상이어야 합니다.") int height,
            @NotNull(message = "지도 해상도는 필수입니다.") Float resolution,
            @NotNull(message = "지도 기준 X는 필수입니다.") Float originX,
            @NotNull(message = "지도 기준 Y는 필수입니다.") Float originY) {
    }

    /**
     * 지도 수정 요청 (PATCH /api/cars/{carId}/maps/{mapId})
     */
    public record UpdateRequest(
            @NotBlank(message = "지도 이름은 필수입니다.") String name) {
    }

    /**
     * 현재 지도 선택 요청 (PATCH /api/cars/{carId}/maps/current)
     */
    public record SetCurrentRequest(
            @NotNull(message = "지도 ID는 필수입니다.") Long mapId) {
    }

    /**
     * 지도 생성 요청 (POST /api/cars/{carId}/maps/generate)
     */
    public record GenerateRequest(
            String name) {
    }
}
