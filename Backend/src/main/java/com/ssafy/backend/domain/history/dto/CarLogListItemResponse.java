package com.ssafy.backend.domain.history.dto;

import com.ssafy.backend.domain.history.domain.CarLog;
import com.ssafy.backend.domain.history.domain.LogStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class CarLogListItemResponse {

    private Long id;
    private Long carId;
    private String mapName;
    private LocalDateTime startAt;
    private LocalDateTime endAt;
    private LogStatus status;
    private int detectionCount;

    public static CarLogListItemResponse from(CarLog carLog) {
        return CarLogListItemResponse.builder()
                .id(carLog.getId())
                .carId(carLog.getCar().getId())
                .mapName(carLog.getMap().getName())
                .startAt(carLog.getStartAt())
                .endAt(carLog.getEndAt())
                .status(carLog.getStatus())
                .detectionCount(carLog.getDetectionCount())
                .build();
    }
}
