package com.ssafy.backend.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

import java.time.LocalDateTime;

@Getter
@RequiredArgsConstructor
public class ErrorResponse {
    private final boolean success = false;
    private final String message;
    private final int status;
    private final LocalDateTime timestamp;

    public static ErrorResponse of(ErrorCode errorCode) {
        return new ErrorResponse(
                errorCode.getMessage(),
                errorCode.getStatus().value(),
                LocalDateTime.now()
        );
    }

    public static ErrorResponse of(ErrorCode errorCode, String message) {
        return new ErrorResponse(
                message,
                errorCode.getStatus().value(),
                LocalDateTime.now()
        );
    }
}
