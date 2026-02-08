package com.ssafy.backend.domain.signaling.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class SignalMessage {

    private String type;
    private String roomId;
    private Object data;
}
