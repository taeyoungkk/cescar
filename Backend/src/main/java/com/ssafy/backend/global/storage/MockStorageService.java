package com.ssafy.backend.global.storage;

import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class MockStorageService implements StorageService {

    private static final String MOCK_BASE_URL = "https://storage.googleapis.com/mock-bucket/";

    @Override
    public String generateSignedUrl(String objectPath, Duration ttl) {
        // 실제 서명 로직 없이 단순히 경로를 결합하여 반환
        // 실제 구현 시에는 GCS/S3 SDK를 사용하여 서명된 URL을 생성해야 함
        return MOCK_BASE_URL + objectPath + "?signed=true&ttl=" + ttl.getSeconds();
    }
}
