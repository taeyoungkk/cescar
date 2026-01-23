package com.ssafy.backend.domain.device.dto;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class DeviceStatusRequest {
    private String id;       // 로봇 ID
    private Integer battery; // 배터리 잔량
    private String status;   // 현재 상태 (IDLE, MOVING 등)
}
