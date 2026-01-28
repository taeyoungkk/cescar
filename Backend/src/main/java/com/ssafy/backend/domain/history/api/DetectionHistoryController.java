package com.ssafy.backend.domain.history.api;

import com.ssafy.backend.domain.history.application.DetectionHistoryService;
import com.ssafy.backend.domain.history.dto.DetectionDetailResponse;
import com.ssafy.backend.domain.history.dto.DetectionListItemResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;

@Tag(name = "History", description = "운행 감지 이력 API")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DetectionHistoryController {

    private final DetectionHistoryService detectionHistoryService;

    @Operation(summary = "운행 기록별 감지 목록 조회", description = "특정 운행 기록(Log ID)에 대한 감지 내역을 페이징하여 조회합니다.")
    @GetMapping("/logs/{logId}/detections")
    public ResponseEntity<Page<DetectionListItemResponse>> getDetections(
            @Parameter(description = "운행 기록 ID", required = true) @PathVariable Long logId,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(detectionHistoryService.searchDetections(logId, pageable));
    }

    @Operation(summary = "감지 상세 조회", description = "감지 내역의 상세 정보를 조회합니다.")
    @GetMapping("/detections/{id}")
    public ResponseEntity<DetectionDetailResponse> getDetectionDetail(
            @Parameter(description = "감지 ID", required = true) @PathVariable Long id) {
        return ResponseEntity.ok(detectionHistoryService.getDetectionDetail(id));
    }

    @Operation(summary = "감지 이미지 원본 보기", description = "감지된 순간의 스냅샷 이미지(원본)로 리다이렉트합니다.")
    @GetMapping("/detections/{id}/image")
    public ResponseEntity<Void> getDetectionImage(
            @Parameter(description = "감지 ID", required = true) @PathVariable Long id) {
        try {
            String signedUrl = detectionHistoryService.getDetectionImageSignedUrl(id);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(signedUrl))
                    .build();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @Operation(summary = "감지 영상 보기", description = "감지된 순간의 영상(원본)으로 리다이렉트합니다.")
    @GetMapping("/detections/{id}/video")
    public ResponseEntity<Void> getDetectionVideo(
            @Parameter(description = "감지 ID", required = true) @PathVariable Long id) {
        try {
            String signedUrl = detectionHistoryService.getDetectionVideoSignedUrl(id);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(signedUrl))
                    .build();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, e.getMessage());
        }
    }

    @Operation(summary = "감지 내역 삭제", description = "특정 감지 내역을 삭제합니다.")
    @DeleteMapping("/detections/{id}")
    public ResponseEntity<Void> deleteDetection(
            @Parameter(description = "감지 ID", required = true) @PathVariable Long id) {
        detectionHistoryService.deleteDetection(id);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "감지 통계 조회", description = "특정 운행 기록의 라벨별 감지 횟수를 조회합니다.")
    @GetMapping("/logs/{logId}/statistics")
    public ResponseEntity<java.util.List<com.ssafy.backend.domain.history.dto.DetectionStatisticsResponse>> getStatistics(
            @Parameter(description = "운행 기록 ID", required = true) @PathVariable Long logId) {
        return ResponseEntity.ok(detectionHistoryService.getDetectionStatistics(logId));
    }

    @Operation(summary = "감지 통합 검색", description = "기간 및 라벨 조건으로 감지 내역을 검색합니다.")
    @GetMapping("/detections/search")
    public ResponseEntity<Page<DetectionListItemResponse>> searchDetections(
            @Parameter(description = "시작 일시 (예: 2024-01-01T00:00:00)", required = true) @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime startDate,
            @Parameter(description = "종료 일시 (예: 2024-01-31T23:59:59)", required = true) @RequestParam @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME) java.time.LocalDateTime endDate,
            @Parameter(description = "라벨 (선택)", required = false) @RequestParam(required = false) String label,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        try {
            return ResponseEntity.ok(detectionHistoryService.searchAllDetections(startDate, endDate, label, pageable));
        } catch (Exception e) {
            e.printStackTrace(); // 서버 콘솔에 에러 로그 출력 (디버깅용)
            throw e;
        }
    }
}
