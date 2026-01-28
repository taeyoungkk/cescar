package com.ssafy.backend.domain.map.api;

import com.ssafy.backend.domain.map.application.SlamMapService;
import com.ssafy.backend.domain.map.dto.SlamMapRequest;
import com.ssafy.backend.domain.map.dto.SlamMapResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Map", description = "지도 관리 API")
@RestController
@RequestMapping("/api/cars/{carId}/maps")
@RequiredArgsConstructor
public class SlamMapController {

    private final SlamMapService slamMapService;

    /**
     * 1️⃣ 지도 등록 API
     * - Jetson에서 생성한 지도 메타데이터 저장
     */
    @Operation(summary = "지도 등록", description = "차량의 지도를 등록합니다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "성공"),
            @ApiResponse(responseCode = "403", description = "권한 없음"),
            @ApiResponse(responseCode = "404", description = "차량 없음")
    })
    @PostMapping
    public ResponseEntity<SlamMapResponse.MapDetailResponse> createMap(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId,
            @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
            @Valid @RequestBody SlamMapRequest.CreateRequest request) {
        SlamMapResponse.MapDetailResponse response = slamMapService.createMap(carId, memberId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * 2️⃣ 지도 목록 조회 API
     * - 삭제되지 않은 지도 목록 최신순 제공
     */
    @Operation(summary = "지도 목록 조회", description = "차량의 지도 목록을 최신순으로 조회합니다.")
    @GetMapping
    public ResponseEntity<List<SlamMapResponse.MapListResponse>> getMapList(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId,
            @Parameter(description = "차량 ID", required = true) @PathVariable Long carId) {
        List<SlamMapResponse.MapListResponse> response = slamMapService.getMapList(carId, memberId);
        return ResponseEntity.ok(response);
    }

    /**
     * 3️⃣ 최신 지도 조회 API
     */
    @Operation(summary = "최신 지도 조회", description = "차량의 최신 지도를 조회합니다.")
    @GetMapping("/latest")
    public ResponseEntity<SlamMapResponse.MapDetailResponse> getLatestMap(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId,
            @Parameter(description = "차량 ID", required = true) @PathVariable Long carId) {
        SlamMapResponse.MapDetailResponse response = slamMapService.getLatestMap(carId, memberId);
        return ResponseEntity.ok(response);
    }

    /**
     * 4️⃣ 지도 상세 조회 API
     */
    @Operation(summary = "지도 상세 조회", description = "지도의 상세 정보를 조회합니다.")
    @GetMapping("/{mapId}")
    public ResponseEntity<SlamMapResponse.MapDetailResponse> getMapDetail(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId,
            @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
            @Parameter(description = "지도 ID", required = true) @PathVariable Long mapId) {
        SlamMapResponse.MapDetailResponse response = slamMapService.getMapDetail(carId, memberId, mapId);
        return ResponseEntity.ok(response);
    }

    /**
     * 5️⃣ 지도 정보 수정 API
     * - 지도 이름 수정
     */
    @Operation(summary = "지도 정보 수정", description = "지도 이름을 수정합니다.")
    @PatchMapping("/{mapId}")
    public ResponseEntity<SlamMapResponse.MapDetailResponse> updateMap(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId,
            @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
            @Parameter(description = "지도 ID", required = true) @PathVariable Long mapId,
            @Valid @RequestBody SlamMapRequest.UpdateRequest request) {
        SlamMapResponse.MapDetailResponse response = slamMapService.updateMap(carId, memberId, mapId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * 6️⃣ 지도 삭제 API (Soft delete)
     */
    @Operation(summary = "지도 삭제", description = "지도를 삭제 처리합니다.")
    @DeleteMapping("/{mapId}")
    public ResponseEntity<SlamMapResponse.SuccessResponse> deleteMap(
            @Parameter(hidden = true) @AuthenticationPrincipal Long memberId,
            @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
            @Parameter(description = "지도 ID", required = true) @PathVariable Long mapId) {
        SlamMapResponse.SuccessResponse response = slamMapService.deleteMap(carId, memberId, mapId);
        return ResponseEntity.ok(response);
    }
}