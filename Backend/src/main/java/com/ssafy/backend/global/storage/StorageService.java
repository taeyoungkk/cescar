package com.ssafy.backend.global.storage;

import java.time.Duration;

public interface StorageService {
    /**
     * 객체 경로(objectPath)에 대한 서명된 URL(Signed URL)을 생성합니다.
     * 
     * @param objectPath 스토리지 내 객체 경로
     * @param ttl        URL 유효 기간
     * @return 서명된 URL
     */
    String generateSignedUrl(String objectPath, Duration ttl);
}
