package com.ssafy.backend.domain.car.dto;

import com.ssafy.backend.domain.car.domain.Car;
import com.ssafy.backend.domain.car.domain.CarMode;
import com.ssafy.backend.domain.car.domain.CarStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 차량 관련 응답 DTO 모음
 */
public class CarResponse {

    /**
     * 차량 소유 연결 성공 응답
     */
    public record ClaimResponse(
            Long carId,
            String nickname,
            CarMode mode,
            Boolean isOnline) {
        public static ClaimResponse of(Car car, CarStatus status) {
            return new ClaimResponse(
                    car.getId(),
                    car.getNickname() != null ? car.getNickname() : car.getDeviceId(),
                    status != null ? status.getMode() : CarMode.STOP,
                    status != null ? status.isOnline() : false);
        }
    }

    /**
     * 차량 상태 업데이트 성공 응답
     */
    public record StatusUpdateResponse(
            boolean success) {
        public static StatusUpdateResponse ok() {
            return new StatusUpdateResponse(true);
        }
    }

    /**
     * 차량 상태 조회 응답
     * - 실시간 위치, 방향, 모드, 온라인 여부 포함
     */
    public record StatusResponse(
            BigDecimal x,
            BigDecimal y,
            Float heading,
            CarMode mode,
            Boolean isOnline,
            LocalDateTime updatedAt) {
        public static StatusResponse from(CarStatus status) {
            return new StatusResponse(
                    status.getX(),
                    status.getY(),
                    status.getHeading(),
                    status.getMode(),
                    status.isOnline(),
                    status.getUpdatedAt());
        }
    }

    /**
     * 차량 모드 변경 성공 응답
     */
    public record ModeChangeResponse(
            boolean success) {
        public static ModeChangeResponse ok() {
            return new ModeChangeResponse(true);
        }
    }

    /**
     * 차량 목록 조회 응답
     * - 기본 정보 + 현재 상태만 포함
     */
    public record CarListResponse(
            Long carId,
            String nickname,
            CarMode mode,
            Boolean isOnline) {
        public static CarListResponse of(Car car, CarStatus status) {
            return new CarListResponse(
                    car.getId(),
                    car.getNickname() != null ? car.getNickname() : car.getDeviceId(),
                    status != null ? status.getMode() : CarMode.STOP,
                    status != null ? status.isOnline() : false);
        }
    }

    /**
     * 차량 상세 조회 응답
     * - 모든 정적 정보 + 동적 상태 포함
     */
    public record CarDetailResponse(
            Long carId,
            String deviceId,
            String claimCode,
            Long ownerId,
            String nickname,
            LocalDateTime createdAt,
            StatusResponse status) {
        public static CarDetailResponse of(Car car, CarStatus status) {
            return new CarDetailResponse(
                    car.getId(),
                    car.getDeviceId(),
                    car.getClaimCode(),
                    car.getOwner() != null ? car.getOwner().getId() : null,
                    car.getNickname() != null ? car.getNickname() : car.getDeviceId(),
                    car.getCreatedAt(),
                    status != null ? StatusResponse.from(status) : null);
        }
    }

    /**
     * 공통 성공 응답
     * - 메시지를 포함한 단순 성공 응답
     */
    public record SuccessResponse(
            boolean success,
            String message) {
        public static SuccessResponse of(String message) {
            return new SuccessResponse(true, message);
        }
    }

    /**
     * 제어 명령 응답
     */
    public record ControlResponse(
            String message,
            String command) {
        public static ControlResponse of(String command) {
            return new ControlResponse("Command sent successfully", command);
        }
    }
}
