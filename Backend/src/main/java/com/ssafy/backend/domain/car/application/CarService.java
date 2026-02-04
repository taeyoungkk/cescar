package com.ssafy.backend.domain.car.application;

import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.car.dao.CarStatusRepository;
import com.ssafy.backend.domain.car.domain.Car;
import com.ssafy.backend.domain.car.domain.CarMode;
import com.ssafy.backend.domain.car.domain.CarStatus;
import com.ssafy.backend.domain.car.dto.CarRequest;
import com.ssafy.backend.domain.car.dto.CarResponse;
import com.ssafy.backend.domain.history.dao.CarLogRepository;
import com.ssafy.backend.domain.history.domain.CarLog;
import com.ssafy.backend.domain.history.domain.LogStatus;
import com.ssafy.backend.domain.map.domain.SlamMap;
import com.ssafy.backend.domain.member.domain.Member;
import com.ssafy.backend.domain.member.dao.MemberRepository;
import com.ssafy.backend.global.exception.CustomException;
import com.ssafy.backend.global.exception.ErrorCode;
import com.ssafy.backend.infrastructure.mqtt.MqttGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 차량 관련 비즈니스 로직 서비스
 * - 차량 등록, 상태 관리, 모드 제어 등의 핵심 기능 제공
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CarService {

    private final CarRepository carRepository;
    private final CarStatusRepository carStatusRepository;
    private final MemberRepository memberRepository;
    private final CarLogRepository carLogRepository;
    private final MqttGateway mqttGateway;
    private final ObjectMapper objectMapper;

    /**
     * 1️⃣ 차량 소유 연결
     * - claimCode로 차량을 조회하여 회원과 연결
     * - 이미 소유자가 있는 경우 예외 발생
     * - CarStatus가 없으면 자동 생성
     */
    @Transactional
    public CarResponse.ClaimResponse claimCar(CarRequest.ClaimRequest request, Long memberId) {
        Car car = carRepository.findByClaimCode(request.claimCode())
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_CLAIM_CODE));

        if (car.getOwner() != null) {
            throw new CustomException(ErrorCode.CAR_ALREADY_CLAIMED);
        }

        CarStatus status = carStatusRepository.findById(car.getId())
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_STATUS_NOT_FOUND));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        car.registerOwner(member);

        // 닉네임 설정 (선택 사항)
        if (request.nickname() != null && !request.nickname().isBlank()) {
            car.updateNickname(request.nickname());
        }

        return CarResponse.ClaimResponse.of(car, status);
    }

    /**
     * 2️⃣ 차량 상태 업데이트 (Jetson용)
     * - 차량의 위치, 방향, 모드, 온라인 상태를 갱신
     * - CarStatus가 없으면 자동 생성 (초기화 목적)
     */
    @Transactional
    public CarResponse.StatusUpdateResponse updateCarStatus(Long carId, CarRequest.StatusUpdateRequest request) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        CarStatus status = carStatusRepository.findById(carId)
                .orElseGet(() -> {
                    CarStatus newStatus = CarStatus.create(car);
                    return carStatusRepository.save(newStatus);
                });

        status.updateStatus(
                request.x(),
                request.y(),
                request.heading(),
                request.mode());

        return CarResponse.StatusUpdateResponse.ok();
    }

    /**
     * 3️⃣ 차량 상태 조회
     * - 실시간 차량 위치 및 상태 정보 반환
     * - 지도/대시보드에서 사용
     */
    public CarResponse.StatusResponse getCarStatus(Long carId, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.UNAUTHORIZED_CAR_ACCESS);
        }

        CarStatus status = carStatusRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_STATUS_NOT_FOUND));

        return CarResponse.StatusResponse.from(status);
    }

    /**
     * 4️⃣ 차량 모드 변경
     * - 원격으로 차량 모드 변경 (STOP / MANUAL / AUTO)
     * - 차량 소유자만 변경 가능
     */
    @Transactional
    public CarResponse.ModeChangeResponse changeCarMode(Long carId, CarRequest.ModeChangeRequest request,
            Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.INVALID_CAR_OWNER);
        }

        CarStatus status = carStatusRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_STATUS_NOT_FOUND));

        status.changeMode(request.mode());

        if (request.mode() == CarMode.STOP) {
            finishCarLogIfRunning(car, LogStatus.COMPLETED);
        }

        try {
            // MQTT 알림 전송: robot/{deviceId}/mode
            // 기기 규격에 맞춰 JSON 형식으로 전송: {"mode": "MANUAL"}
            Map<String, String> payload = new HashMap<>();
            payload.put("mode", request.mode().name());
            String jsonPayload = objectMapper.writeValueAsString(payload);

            String topic = "robot/" + car.getDeviceId() + "/mode";
            mqttGateway.sendToMqtt(jsonPayload, topic);
        } catch (Exception e) {
            // 로그 기록 등을 추가할 수 있으나 현재는 단순 예외 처리
        }

        return CarResponse.ModeChangeResponse.ok();
    }

    /**
     * 5️⃣ 차량 목록 조회
     * - 로그인한 회원이 소유한 모든 차량 조회
     * - 각 차량의 기본 정보와 현재 상태 포함
     */
    public List<CarResponse.CarListResponse> getCarList(Long memberId) {
        List<Car> cars = carRepository.findAllByOwnerId(memberId);

        return cars.stream()
                .map(car -> {
                    CarStatus status = carStatusRepository.findById(car.getId()).orElse(null);
                    return CarResponse.CarListResponse.of(car, status);
                })
                .collect(Collectors.toList());
    }

    /**
     * 6️⃣ 차량 상세 조회
     * - 차량의 모든 정보 조회 (정적 + 동적)
     * - 차량 소유자만 조회 가능
     */
    public CarResponse.CarDetailResponse getCarDetail(Long carId, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.UNAUTHORIZED_CAR_ACCESS);
        }

        CarStatus status = carStatusRepository.findById(carId).orElse(null);

        return CarResponse.CarDetailResponse.of(car, status);
    }

    /**
     * 차량 소유권 해제
     * - 차량과 회원의 연결을 끊음
     * - 현재 소유자만 해제 가능
     */
    @Transactional
    public CarResponse.SuccessResponse releaseCar(Long carId, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        car.releaseOwner(member);

        return CarResponse.SuccessResponse.of("Car ownership has been released");
    }

    /**
     * 차량 닉네임 수정
     * - 차량의 표시 이름 변경
     * - 차량 소유자만 변경 가능
     */
    @Transactional
    public CarResponse.SuccessResponse updateCarNickname(Long carId, String nickname, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.INVALID_CAR_OWNER);
        }

        car.updateNickname(nickname);

        return CarResponse.SuccessResponse.of("Car nickname has been updated");
    }

    /**
     * 9️⃣ 차량 직접 제어 (수동 주행)
     * - v/w 속도 명령을 MQTT로 전달
     * - MANUAL 모드일 때만 작동 가능 (권장)
     */
    @Transactional
    public CarResponse.ControlResponse controlCar(Long carId, CarRequest.ControlRequest request, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.INVALID_CAR_OWNER);
        }

        CarStatus status = carStatusRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_STATUS_NOT_FOUND));

        if (status.getMode() != CarMode.MANUAL) {
            throw new CustomException(ErrorCode.INVALID_CAR_MODE);
        }

        startCarLogIfAbsent(car);

        try {
            // v: linear velocity, w: angular velocity
            Map<String, Double> payload = new HashMap<>();
            double v = request.v() != null ? -request.v() : 0.0;
            double w = request.w() != null ? -request.w() : 0.0;
            payload.put("v", v);
            payload.put("w", w);

            String jsonPayload = objectMapper.writeValueAsString(payload);

            // MQTT 명령 전송: robot/{deviceId}/control
            String topic = "robot/" + car.getDeviceId() + "/control";
            mqttGateway.sendToMqtt(jsonPayload, topic);
        } catch (Exception e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        return CarResponse.ControlResponse.of("v=" + (-request.v()) + ",w=" + (-request.w()));
    }

    /**
     * 🔟 자율 주행 미션 부여 (구역 탐사)
     * - 지정된 구역(좌표 리스트)을 젯슨에게 전달
     * - AUTO 모드일 때만 작동 가능
     */
    @Transactional
    public CarResponse.SuccessResponse assignMission(Long carId, CarRequest.MissionRequest request, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.INVALID_CAR_OWNER);
        }

        CarStatus status = carStatusRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_STATUS_NOT_FOUND));

        if (status.getMode() != CarMode.AUTO) {
            throw new CustomException(ErrorCode.INVALID_CAR_MODE);
        }

        startCarLogIfAbsent(car);

        try {
            // 미션 데이터를 JSON 문자열로 변환
            String missionJson = objectMapper.writeValueAsString(request);

            // MQTT 미션 전송: robot/{deviceId}/mission
            String topic = "robot/" + car.getDeviceId() + "/mission";
            mqttGateway.sendToMqtt(missionJson, topic);

        } catch (Exception e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        return CarResponse.SuccessResponse.of("Mission has been assigned successfully");
    }

    private void startCarLogIfAbsent(Car car) {
        if (car == null) {
            return;
        }
        if (car.getOwner() == null) {
            return;
        }
        Long ownerId = car.getOwner().getId();
        boolean hasRunning = carLogRepository
                .findFirstByCarIdAndOwnerIdAndStatusOrderByStartAtDesc(car.getId(), ownerId, LogStatus.RUNNING)
                .isPresent();
        if (hasRunning) {
            return;
        }
        SlamMap currentMap = car.getCurrentMap();
        if (currentMap == null) {
            return;
        }
        carLogRepository.save(CarLog.create(car, currentMap, ownerId));
    }

    private void finishCarLogIfRunning(Car car, LogStatus status) {
        if (car == null) {
            return;
        }
        if (car.getOwner() == null) {
            return;
        }
        Long ownerId = car.getOwner().getId();
        carLogRepository.findFirstByCarIdAndOwnerIdAndStatusOrderByStartAtDesc(car.getId(), ownerId, LogStatus.RUNNING)
                .ifPresent(log -> {
                    log.finish(status);
                    carLogRepository.save(log);
                });
    }
}
