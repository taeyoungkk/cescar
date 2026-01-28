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

    /**
     * 감지 내역 삭제
     */
    @Transactional
    public void deleteDetection(Long detectionId) {
        if (!detectionRepository.existsById(detectionId)) {
            throw new IllegalArgumentException("해당 감지 내역을 찾을 수 없습니다. (ID: " + detectionId + ")");
        }
        detectionRepository.deleteById(detectionId);
    }

    private Detection findDetectionById(Long detectionId) {
        return detectionRepository.findById(detectionId)
                .orElseThrow(() -> new IllegalArgumentException("해당 감지 내역을 찾을 수 없습니다. (ID: " + detectionId + ")"));
    }

    /**
     * 감지 통계 조회 (라벨별 카운트)
     */
    public java.util.List<com.ssafy.backend.domain.history.dto.DetectionStatisticsResponse> getDetectionStatistics(
            Long logId) {
        return detectionRepository.countByLabel(logId);
    }

    /**
     * 감지 통합 검색 (기간, 라벨)
     */
    public Page<DetectionListItemResponse> searchAllDetections(
            java.time.LocalDateTime startDate,
            java.time.LocalDateTime endDate,
            String label,
            Pageable pageable) {
        return detectionRepository.searchDetections(startDate, endDate, label, pageable)
                .map(DetectionListItemResponse::from);
    }
}
