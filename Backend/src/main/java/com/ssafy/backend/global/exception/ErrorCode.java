package com.ssafy.backend.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // Car 관련 에러
    CAR_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 차량입니다."),
    CAR_ALREADY_CLAIMED(HttpStatus.CONFLICT, "이미 등록된 차량입니다."),
    CAR_STATUS_NOT_FOUND(HttpStatus.NOT_FOUND, "차량 상태 정보가 없습니다."),
    INVALID_CLAIM_CODE(HttpStatus.BAD_REQUEST, "유효하지 않은 claimCode입니다."),
    UNAUTHORIZED_CAR_ACCESS(HttpStatus.FORBIDDEN, "차량에 대한 권한이 없습니다."),
    INVALID_CAR_OWNER(HttpStatus.FORBIDDEN, "차량 소유자만 접근할 수 있습니다."),
    CAR_OFFLINE(HttpStatus.BAD_REQUEST, "차량 전원이 꺼져 있어 등록할 수 없습니다."),
    INVALID_CAR_MODE(HttpStatus.BAD_REQUEST, "수동 모드에서만 제어가 가능합니다."),

    // Member 관련 에러
    MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "존재하지 않는 회원입니다."),
    ALREADY_REGISTERED_MEMBER(HttpStatus.CONFLICT, "이미 가입된 이메일입니다."),
    WRONG_PASSWORD(HttpStatus.UNAUTHORIZED, "비밀번호가 일치하지 않습니다."),

    // 공통 에러
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    ACCESS_DENIED(HttpStatus.FORBIDDEN, "접근 권한이 없습니다."),
    INVALID_TOKEN(HttpStatus.UNAUTHORIZED, "유효하지 않은 토큰입니다."),
    TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "만료된 토큰입니다."),
    INVALID_INPUT_VALUE(HttpStatus.BAD_REQUEST, "입력값이 올바르지 않습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 에러가 발생했습니다.");

    private final HttpStatus status;
    private final String message;
}
