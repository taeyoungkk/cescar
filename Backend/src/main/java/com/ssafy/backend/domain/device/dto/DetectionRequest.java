package com.ssafy.backend.domain.device.dto;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class DetectionRequest {
    private String timestamp;
    private String object_type;
    private Double confidence;
    private String status;
    private String robot_id;
    private String note;
}
