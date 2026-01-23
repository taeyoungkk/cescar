package com.ssafy.backend.domain.history.domain;

public enum LogStatus {
    RUNNING, // 주행 중
    COMPLETED, // 운행 정상 완료
    STOPPED,   // 강제 정지됨
    ERROR      // 에러 발생
}
