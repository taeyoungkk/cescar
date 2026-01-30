package com.ssafy.backend.domain.car.dto;

import com.ssafy.backend.domain.car.domain.CarMode;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

import java.math.BigDecimal;

/**
 * 차량 관련 요청 DTO 모음
 */
public class CarRequest {

        /**
         * 차량 소유 연결 요청 (POST /api/cars/claim)
         */
        public record ClaimRequest(
                        @NotBlank(message = "claimCode is required") String claimCode,

                        String nickname) {
        }

        /**
         * 차량 상태 업데이트 요청 (PATCH /api/cars/{carId}/status)
         * - Jetson에서 주기적으로 전송
         */
        public record StatusUpdateRequest(
                        @NotNull(message = "x coordinate is required") BigDecimal x,

                        @NotNull(message = "y coordinate is required") BigDecimal y,

                        @NotNull(message = "heading is required") Float heading,

                        @NotNull(message = "mode is required") CarMode mode,

                        @NotNull(message = "isOnline is required") Boolean isOnline) {
        }

        /**
         * 차량 모드 변경 요청 (PATCH /api/cars/{carId}/mode)
         * - STOP, MANUAL, AUTO 중 하나
         */
        public record ModeChangeRequest(
                        @NotNull(message = "mode is required") CarMode mode) {
        }

        /**
         * 차량 제어 요청 (PATCH /api/cars/{carId}/control)
         */
                public record ControlRequest(
                        @Schema(description = "Linear velocity (v)", example = "0.5") @NotNull(message = "v is required") Double v,
                        @Schema(description = "Angular velocity (w)", example = "0.0") @NotNull(message = "w is required") Double w) {
        }

        /**
         * 차량 정보 수정 요청 (PATCH /api/cars/{carId})
         * - 현재는 닉네임만 수정 가능
         */
        public record UpdateCarRequest(
                        String nickname) {
        }

        /**
         * 자율 주행 미션 요청 (PATCH /api/cars/{carId}/mission)
         */
        public record MissionRequest(
                        @NotNull(message = "area is required") List<Point> area) {
        }

        public record Point(
                        @NotNull BigDecimal x,
                        @NotNull BigDecimal y) {
        }
}
