package com.ssafy.backend.global.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StorageConfig {

    @Value("${gcs.project-id:}")
    private String projectId;

    @Value("${gcs.bucket:}")
    private String bucket;

    @Value("${gcs.credentials-path:}")
    private String credentialsPath;

    @Bean
    public StorageService storageService() {
        if (bucket == null || bucket.isBlank()) {
            return new MockStorageService();
        }
        return new GcsStorageService(projectId, bucket, credentialsPath);
    }
}
