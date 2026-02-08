package com.ssafy.backend.global.storage;

import com.google.auth.oauth2.ServiceAccountCredentials;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.HttpMethod;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.google.cloud.storage.Storage.SignUrlOption;

import java.io.FileInputStream;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class GcsStorageService implements StorageService {

    private final Storage storage;
    private final String bucket;

    public GcsStorageService(String projectId, String bucket, String credentialsPath) {
        StorageOptions.Builder builder = StorageOptions.newBuilder();
        if (projectId != null && !projectId.isBlank()) {
            builder.setProjectId(projectId);
        }
        if (credentialsPath != null && !credentialsPath.isBlank()) {
            try {
                builder.setCredentials(ServiceAccountCredentials.fromStream(new FileInputStream(credentialsPath)));
            } catch (Exception e) {
                throw new IllegalStateException("Failed to load GCS credentials: " + credentialsPath, e);
            }
        }
        this.storage = builder.build().getService();
        this.bucket = bucket;
    }

    @Override
    public String generateSignedUrl(String objectPath, Duration ttl) {
        return signUrl(objectPath, ttl, HttpMethod.GET, null);
    }

    @Override
    public String generateUploadSignedUrl(String objectPath, Duration ttl, String contentType) {
        return signUrl(objectPath, ttl, HttpMethod.PUT, contentType);
    }

    @Override
    public String generateDownloadSignedUrl(String objectPath, Duration ttl) {
        return signUrl(objectPath, ttl, HttpMethod.GET, null);
    }

    private String signUrl(String objectPath, Duration ttl, HttpMethod method, String contentType) {
        BlobInfo blobInfo = BlobInfo.newBuilder(BlobId.of(bucket, objectPath)).build();
        List<SignUrlOption> options = new ArrayList<>();
        options.add(SignUrlOption.withV4Signature());
        options.add(SignUrlOption.httpMethod(method));
        if (contentType != null && !contentType.isBlank() && method == HttpMethod.PUT) {
            options.add(SignUrlOption.withContentType());
        }
        return storage.signUrl(blobInfo, ttl.getSeconds(), TimeUnit.SECONDS, options.toArray(new SignUrlOption[0]))
                .toString();
    }
}
