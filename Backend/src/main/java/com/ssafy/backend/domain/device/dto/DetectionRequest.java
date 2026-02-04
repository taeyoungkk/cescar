package com.ssafy.backend.domain.device.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
@JsonIgnoreProperties(ignoreUnknown = true)
public class DetectionRequest {
    private String timestamp;
    private String object_type;
    private Double confidence;
    private String status;
    private String robot_id;
    private String note;
    // MQTT 탐지 좌표 및 리소스 경로
    private Double x;
    private Double y;
    @JsonAlias({ "screenshot_url", "image_url" })
    private String imageUrl;
    @JsonAlias({ "video_url" })
    private String videoUrl;
}
