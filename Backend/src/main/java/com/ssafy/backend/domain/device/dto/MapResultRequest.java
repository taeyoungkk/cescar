package com.ssafy.backend.domain.device.dto;

import lombok.Getter;
import lombok.ToString;

@Getter
@ToString
public class MapResultRequest {
    private String requestId;
    private String status;
    private String name;
    private String imageUrl;
    private Integer width;
    private Integer height;
    private Float resolution;
    private Float originX;
    private Float originY;
    private String errorCode;
    private String errorMessage;
}
