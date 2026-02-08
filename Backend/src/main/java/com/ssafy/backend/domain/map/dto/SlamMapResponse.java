package com.ssafy.backend.domain.map.dto;

import com.ssafy.backend.domain.map.domain.SlamMap;
import java.time.LocalDateTime;

public class SlamMapResponse {

    /**
     * 지도 목록 응답
     */
    public record MapListResponse(
            Long id,
            String name,
            String imageUrl,
            LocalDateTime createdAt) {
        public static MapListResponse from(SlamMap map) {
            return new MapListResponse(
                    map.getId(),
                    map.getName(),
                    map.getImageUrl(),
                    map.getCreatedAt());
        }
    }

    /**
     * 지도 상세 응답
     */
    public record MapDetailResponse(
            Long id,
            Long carId,
            String name,
            String imageUrl,
            int width,
            int height,
            float resolution,
            float originX,
            float originY,
            LocalDateTime createdAt) {
        public static MapDetailResponse from(SlamMap map) {
            return new MapDetailResponse(
                    map.getId(),
                    map.getCar().getId(),
                    map.getName(),
                    map.getImageUrl(),
                    map.getWidth(),
                    map.getHeight(),
                    map.getResolution(),
                    map.getOriginX(),
                    map.getOriginY(),
                    map.getCreatedAt());
        }
    }

    /**
     * 지도 생성 응답
     */
    public record MapGenerateResponse(
            String requestId,
            String status) {
    }

    /**
     * 공통 성공 응답
     */
    public record SuccessResponse(
            boolean success,
            String message) {
        public static SuccessResponse of(String message) {
            return new SuccessResponse(true, message);
        }
    }
}
