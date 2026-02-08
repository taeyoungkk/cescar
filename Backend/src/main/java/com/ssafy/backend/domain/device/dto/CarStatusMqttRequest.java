package com.ssafy.backend.domain.device.dto;

import com.ssafy.backend.domain.car.domain.CarMode;
import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class CarStatusMqttRequest {
    // MQTT로 수신하는 차량 위치/모드 상태
    private Double x;
    private Double y;
    private Float heading;
    private CarMode mode;
}
