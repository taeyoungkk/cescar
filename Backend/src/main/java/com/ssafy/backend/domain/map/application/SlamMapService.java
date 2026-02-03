package com.ssafy.backend.domain.map.application;

import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.car.domain.Car;
import com.ssafy.backend.domain.map.dao.SlamMapRepository;
import com.ssafy.backend.domain.map.domain.SlamMap;
import com.ssafy.backend.domain.map.dto.SlamMapRequest;
import com.ssafy.backend.domain.map.dto.SlamMapResponse;
import com.ssafy.backend.global.exception.CustomException;
import com.ssafy.backend.global.exception.ErrorCode;
import com.ssafy.backend.global.storage.StorageService;
import com.ssafy.backend.infrastructure.mqtt.MqttGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SlamMapService {

    private final CarRepository carRepository;
    private final SlamMapRepository slamMapRepository;
    private final StorageService storageService;
    private final MqttGateway mqttGateway;
    private final ObjectMapper objectMapper;

    @Value("${storage.signed-url-ttl}")
    private Duration signedUrlTtl;

    @Transactional
    public SlamMapResponse.MapDetailResponse createMap(Long carId, Long memberId, SlamMapRequest.CreateRequest request) {
        Car car = getOwnedCar(carId, memberId);

        SlamMap map = SlamMap.create(
                car,
                request.name(),
                request.imageUrl(),
                request.width(),
                request.height(),
                request.resolution(),
                request.originX(),
                request.originY()
        );

        SlamMap savedMap = slamMapRepository.save(map);
        car.updateCurrentMap(savedMap);

        return toMapDetailResponse(savedMap);
    }

    @Transactional
    public SlamMapResponse.MapGenerateResponse generateMap(Long carId, Long memberId,
                                                           SlamMapRequest.GenerateRequest request) {
        Car car = getOwnedCar(carId, memberId);

        String requestId = UUID.randomUUID().toString();
        String name = request.name();
        if (name == null || name.isBlank()) {
            String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmm"));
            name = "map_" + timestamp;
        }

        try {
            Map<String, String> payload = new HashMap<>();
            payload.put("requestId", requestId);
            payload.put("name", name);

            String jsonPayload = objectMapper.writeValueAsString(payload);
            String topic = "robot/" + car.getDeviceId() + "/map_generate";
            mqttGateway.sendToMqtt(jsonPayload, topic);
        } catch (Exception e) {
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }

        return new SlamMapResponse.MapGenerateResponse(requestId, "queued");
    }

    @Transactional
    public boolean saveMapFromResult(String deviceId, com.ssafy.backend.domain.device.dto.MapResultRequest result) {
        Car car = carRepository.findByDeviceId(deviceId).orElse(null);
        if (car == null) {
            return false;
        }

        SlamMap map = SlamMap.create(
                car,
                result.getName(),
                result.getImageUrl(),
                result.getWidth(),
                result.getHeight(),
                result.getResolution(),
                result.getOriginX(),
                result.getOriginY()
        );

        SlamMap savedMap = slamMapRepository.save(map);
        car.updateCurrentMap(savedMap);
        return true;
    }

    public List<SlamMapResponse.MapListResponse> getMapList(Long carId, Long memberId) {
        getOwnedCar(carId, memberId);

        return slamMapRepository.findAllByCarIdAndDeletedAtIsNullOrderByCreatedAtDesc(carId)
                .stream()
                .map(this::toMapListResponse)
                .collect(Collectors.toList());
    }

    public SlamMapResponse.MapDetailResponse getCurrentMap(Long carId, Long memberId) {
        Car car = getOwnedCar(carId, memberId);

        SlamMap map = car.getCurrentMap();
        if (map == null || map.getDeletedAt() != null) {
            throw new CustomException(ErrorCode.MAP_NOT_FOUND);
        }

        return toMapDetailResponse(map);
    }

    public SlamMapResponse.MapDetailResponse getMapDetail(Long carId, Long memberId, Long mapId) {
        getOwnedCar(carId, memberId);

        SlamMap map = slamMapRepository.findByIdAndCarIdAndDeletedAtIsNull(mapId, carId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAP_NOT_FOUND));

        return toMapDetailResponse(map);
    }

    @Transactional
    public SlamMapResponse.MapDetailResponse updateMap(Long carId, Long memberId, Long mapId,
                                                       SlamMapRequest.UpdateRequest request) {
        getOwnedCar(carId, memberId);

        SlamMap map = slamMapRepository.findByIdAndCarIdAndDeletedAtIsNull(mapId, carId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAP_NOT_FOUND));

        map.updateInfo(request.name(), null);

        return toMapDetailResponse(map);
    }

    @Transactional
    public SlamMapResponse.SuccessResponse deleteMap(Long carId, Long memberId, Long mapId) {
        Car car = getOwnedCar(carId, memberId);

        SlamMap map = slamMapRepository.findByIdAndCarIdAndDeletedAtIsNull(mapId, carId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAP_NOT_FOUND));

        map.softDelete();

        if (car.getCurrentMap() != null && car.getCurrentMap().getId().equals(map.getId())) {
            SlamMap latest = slamMapRepository.findFirstByCarIdAndDeletedAtIsNullOrderByCreatedAtDesc(carId)
                    .orElse(null);
            car.updateCurrentMap(latest);
        }

        return SlamMapResponse.SuccessResponse.of("지도 삭제가 완료되었습니다.");
    }

    @Transactional
    public SlamMapResponse.MapDetailResponse setCurrentMap(Long carId, Long memberId, SlamMapRequest.SetCurrentRequest request) {
        Car car = getOwnedCar(carId, memberId);

        SlamMap map = slamMapRepository.findByIdAndCarIdAndDeletedAtIsNull(request.mapId(), carId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAP_NOT_FOUND));

        car.updateCurrentMap(map);

        return toMapDetailResponse(map);
    }

    private Car getOwnedCar(Long carId, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.UNAUTHORIZED_CAR_ACCESS);
        }

        return car;
    }

    private SlamMapResponse.MapDetailResponse toMapDetailResponse(SlamMap map) {
        return new SlamMapResponse.MapDetailResponse(
                map.getId(),
                map.getCar().getId(),
                map.getName(),
                resolveImageUrl(map.getImageUrl()),
                map.getWidth(),
                map.getHeight(),
                map.getResolution(),
                map.getOriginX(),
                map.getOriginY(),
                map.getCreatedAt()
        );
    }

    private SlamMapResponse.MapListResponse toMapListResponse(SlamMap map) {
        return new SlamMapResponse.MapListResponse(
                map.getId(),
                map.getName(),
                resolveImageUrl(map.getImageUrl()),
                map.getCreatedAt()
        );
    }

    private String resolveImageUrl(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) {
            return null;
        }
        if (objectPath.startsWith("http://") || objectPath.startsWith("https://")) {
            return objectPath;
        }
        return storageService.generateSignedUrl(objectPath, signedUrlTtl);
    }
}
