package com.ssafy.backend.global.storage.api;

import com.ssafy.backend.global.storage.StorageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/storage")
@RequiredArgsConstructor
public class StorageController {

    private final StorageService storageService;

    @Value("${storage.signed-url-ttl}")
    private Duration signedUrlTtl;

    @PostMapping("/presign")
    public ResponseEntity<PresignResponse> presign(@Valid @RequestBody PresignRequest request) {
        String method = request.method().toUpperCase();
        String signedUrl;

        if ("PUT".equals(method)) {
            signedUrl = storageService.generateUploadSignedUrl(request.objectPath(), signedUrlTtl, request.contentType());
        } else {
            signedUrl = storageService.generateDownloadSignedUrl(request.objectPath(), signedUrlTtl);
        }

        return ResponseEntity.ok(new PresignResponse(request.objectPath(), signedUrl, method));
    }

    public record PresignRequest(
            @NotBlank String objectPath,
            @NotBlank String method,
            String contentType) {
    }

    public record PresignResponse(
            String objectPath,
            String signedUrl,
            String method) {
    }
}
