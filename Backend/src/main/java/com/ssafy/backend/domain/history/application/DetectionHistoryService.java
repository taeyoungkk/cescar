package com.ssafy.backend.domain.history.application;

import com.ssafy.backend.domain.history.dao.DetectionRepository;
import com.ssafy.backend.domain.history.domain.Detection;
import com.ssafy.backend.domain.history.dto.DetectionDetailResponse;
import com.ssafy.backend.domain.history.dto.DetectionListItemResponse;
import com.ssafy.backend.global.storage.StorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class DetectionHistoryService {

    private final DetectionRepository detectionRepository;
    private final StorageService storageService;

    // TODO: 프로덕션 환경에서는 Config로 분리 권장 (10분)
    private static final Duration SIGNED_URL_TTL = Duration.ofMinutes(10);

    /**
     * 특정 운행 기록(CarLog)의 탐지 내역 목록 조회
     */
    public Page<DetectionListItemResponse> searchDetections(Long logId, Pageable pageable) {
        return detectionRepository.findByCarLogId(logId, pageable)
                .map(DetectionListItemResponse::from);
    }

    /**
     * 탐지 상세 정보 조회
     */
    public DetectionDetailResponse getDetectionDetail(Long detectionId) {
        Detection detection = findDetectionById(detectionId);
        return DetectionDetailResponse.from(detection);
    }

    /**
     * 감지 이미지 원본에 대한 서명된 URL 발급 (리다이렉트용)
     */
    public String getDetectionImageSignedUrl(Long detectionId) {
        Detection detection = findDetectionById(detectionId);
        String objectPath = detection.getImageUrl();

        if (objectPath == null || objectPath.isBlank()) {
            throw new IllegalArgumentException("이미지 경로가 존재하지 않습니다.");
        }

        return storageService.generateSignedUrl(objectPath, SIGNED_URL_TTL);
    }

    /**
     * 감지 영상 원본에 대한 서명된 URL 발급 (리다이렉트용)
     */
    public String getDetectionVideoSignedUrl(Long detectionId) {
        Detection detection = findDetectionById(detectionId);
        String objectPath = detection.getVideoUrl();

        if (objectPath == null || objectPath.isBlank()) {
            throw new IllegalArgumentException("영상 경로가 존재하지 않습니다.");
        }

        return storageService.generateSignedUrl(objectPath, SIGNED_URL_TTL);
    }

    private Detection findDetectionById(Long detectionId) {
        return detectionRepository.findById(detectionId)
                .orElseThrow(() -> new IllegalArgumentException("해당 감지 내역을 찾을 수 없습니다. (ID: " + detectionId + ")"));
    }
}
