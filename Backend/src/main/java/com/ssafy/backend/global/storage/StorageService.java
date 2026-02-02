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

    /**
     * 업로드(PUT)용 서명된 URL을 생성합니다.
     */
    default String generateUploadSignedUrl(String objectPath, Duration ttl, String contentType) {
        return generateSignedUrl(objectPath, ttl);
    }

    /**
     * 다운로드(GET)용 서명된 URL을 생성합니다.
     */
    default String generateDownloadSignedUrl(String objectPath, Duration ttl) {
        return generateSignedUrl(objectPath, ttl);
    }
}
