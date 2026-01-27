package com.ssafy.backend.domain.car.api;

import com.ssafy.backend.domain.car.application.CarService;
import com.ssafy.backend.domain.car.dto.CarRequest;
import com.ssafy.backend.domain.car.dto.CarResponse;
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

/**
 * 차량 관련 API 컨트롤러
 * - 차량 소유 연결, 상태 조회/업데이트, 모드 변경 등의 기능 제공
 * - TODO: 인증 필터 연동 필요 (memberId 자동 주입)
 */
@Tag(name = "Car", description = "차량 관리 API")
@RestController
@RequestMapping("/api/cars")
@RequiredArgsConstructor
public class CarController {

        private final CarService carService;

        /**
         * 1️⃣ 차량 소유 연결 (POST /api/cars/claim)
         * - claimCode로 이미 존재하는 차량에 현재 유저를 오너로 등록
         * - 최초 등록 시 호출
         */
        @Operation(summary = "차량 소유권 등록", description = "클레임 코드를 사용하여 차량의 소유권을 등록합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "400", description = "잘못된 클레임 코드"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @PostMapping("/claim")
        public ResponseEntity<CarResponse.ClaimResponse> claimCar(
                        @Parameter(description = "차량 클레임 요청 정보", required = true) @Valid @RequestBody CarRequest.ClaimRequest request,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.ClaimResponse response = carService.claimCar(request, memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 2️⃣ 차량 상태 업데이트 (PATCH /api/cars/{carId}/status)
         * - Jetson에서 주기적으로 차량 위치/상태 갱신
         * - TODO: Jetson 전용 인증 필요 (deviceId 또는 API Key)
         */
        @Operation(summary = "차량 상태 업데이트", description = "Jetson 장치에서 차량의 위치 및 상태 정보를 업데이트합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @PatchMapping("/{carId}/status")
        public ResponseEntity<CarResponse.StatusUpdateResponse> updateCarStatus(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(description = "차량 상태 업데이트 정보", required = true) @Valid @RequestBody CarRequest.StatusUpdateRequest request) {
                CarResponse.StatusUpdateResponse response = carService.updateCarStatus(carId, request);
                return ResponseEntity.ok(response);
        }

        /**
         * 3️⃣ 차량 상태 조회 (GET /api/cars/{carId}/status)
         * - 지도/대시보드용 실시간 상태 조회
         * - 정적 정보 제외, Status 전용
         */
        @Operation(summary = "차량 상태 조회", description = "차량의 현재 상태 정보를 조회합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @GetMapping("/{carId}/status")
        public ResponseEntity<CarResponse.StatusResponse> getCarStatus(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.StatusResponse response = carService.getCarStatus(carId, memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 4️⃣ 차량 모드 변경 (PATCH /api/cars/{carId}/mode)
         * - 원격 제어용 모드 변경 (STOP / MANUAL / AUTO)
         * - 차량 소유자만 가능
         */
        @Operation(summary = "차량 모드 변경", description = "차량의 주행 모드를 변경합니다 (STOP/MANUAL/AUTO).")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "403", description = "권한 없음"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @PatchMapping("/{carId}/mode")
        public ResponseEntity<CarResponse.ModeChangeResponse> changeCarMode(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(description = "모드 변경 요청 정보", required = true) @Valid @RequestBody CarRequest.ModeChangeRequest request,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.ModeChangeResponse response = carService.changeCarMode(carId, request, memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 5️⃣ 차량 목록 조회 (GET /api/cars)
         * - 로그인 유저가 소유한 차량 목록 조회
         * - 지도용 목록, 최소한의 Status 포함
         */
        @Operation(summary = "차량 목록 조회", description = "현재 사용자가 소유한 차량 목록을 조회합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공")
        })
        @GetMapping
        public ResponseEntity<List<CarResponse.CarListResponse>> getCarList(
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                List<CarResponse.CarListResponse> response = carService.getCarList(memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 6️⃣ 차량 상세 조회 (GET /api/cars/{carId})
         * - 차량 상세 정보 + Status 전체 조회
         * - 설정/정보 화면 전용, 정적 + 동적 정보 포함
         */
        @Operation(summary = "차량 상세 조회", description = "차량의 상세 정보와 현재 상태를 함께 조회합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "403", description = "권한 없음"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @GetMapping("/{carId}")
        public ResponseEntity<CarResponse.CarDetailResponse> getCarDetail(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.CarDetailResponse response = carService.getCarDetail(carId, memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 7️⃣ 차량 소유권 해제 (DELETE /api/cars/{carId}/claim)
         * - 차량과 소유자의 연결 해제
         * - 현재 소유자만 가능
         */
        @Operation(summary = "차량 소유권 해제", description = "차량의 소유권을 해제합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "403", description = "권한 없음"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @DeleteMapping("/{carId}/claim")
        public ResponseEntity<CarResponse.SuccessResponse> releaseCar(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.SuccessResponse response = carService.releaseCar(carId, memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 8️⃣ 차량 닉네임 수정 (PATCH /api/cars/{carId})
         * - 차량의 닉네임 변경
         * - 차량 소유자만 가능
         */
        @Operation(summary = "차량 닉네임 수정", description = "차량의 닉네임을 변경합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "403", description = "권한 없음"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @PatchMapping("/{carId}")
        public ResponseEntity<CarResponse.SuccessResponse> updateCarNickname(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(description = "차량 닉네임 업데이트 정보", required = true) @Valid @RequestBody CarRequest.UpdateCarRequest request,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.SuccessResponse response = carService.updateCarNickname(carId, request.nickname(),
                                memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 9️⃣ 차량 직접 제어 (PATCH /api/cars/{carId}/control)
         * - 수동 주행을 위한 이동 명령 전달 (UP, DOWN, LEFT, RIGHT, STOP)
         * - 차량 소유자만 가능
         */
        @Operation(summary = "차량 수동 제어", description = "차량에 실시간 이동 명령을 전달합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "403", description = "권한 없음"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @PatchMapping("/{carId}/control")
        public ResponseEntity<CarResponse.ControlResponse> controlCar(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(description = "차량 제어 요청 정보", required = true) @Valid @RequestBody CarRequest.ControlRequest request,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.ControlResponse response = carService.controlCar(carId, request, memberId);
                return ResponseEntity.ok(response);
        }

        /**
         * 🔟 자율 주행 미션 부여 (PATCH /api/cars/{carId}/mission)
         * - 구역 탐사를 위한 좌표 리스트 전달
         * - 차량 소유자만 가능
         */
        @Operation(summary = "자율 주행 미션 부여", description = "차량에 구역 탐사를 위한 자율 주행 미션을 부여합니다.")
        @ApiResponses(value = {
                        @ApiResponse(responseCode = "200", description = "성공"),
                        @ApiResponse(responseCode = "400", description = "수동 모드가 아님"),
                        @ApiResponse(responseCode = "403", description = "권한 없음"),
                        @ApiResponse(responseCode = "404", description = "차량을 찾을 수 없음")
        })
        @PatchMapping("/{carId}/mission")
        public ResponseEntity<CarResponse.SuccessResponse> assignMission(
                        @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
                        @Parameter(description = "미션 요청 정보", required = true) @Valid @RequestBody CarRequest.MissionRequest request,
                        @Parameter(hidden = true) @AuthenticationPrincipal Long memberId) {
                CarResponse.SuccessResponse response = carService.assignMission(carId, request, memberId);
                return ResponseEntity.ok(response);
        }
}
