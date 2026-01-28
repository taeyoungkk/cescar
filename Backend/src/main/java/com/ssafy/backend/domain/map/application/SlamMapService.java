package com.ssafy.backend.domain.map.application;

import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.car.domain.Car;
import com.ssafy.backend.domain.map.dao.SlamMapRepository;
import com.ssafy.backend.domain.map.domain.SlamMap;
import com.ssafy.backend.domain.map.dto.SlamMapRequest;
import com.ssafy.backend.domain.map.dto.SlamMapResponse;
import com.ssafy.backend.global.exception.CustomException;
import com.ssafy.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SlamMapService {

    private final CarRepository carRepository;
    private final SlamMapRepository slamMapRepository;

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

        return SlamMapResponse.MapDetailResponse.from(savedMap);
    }

    public List<SlamMapResponse.MapListResponse> getMapList(Long carId, Long memberId) {
        getOwnedCar(carId, memberId);

        return slamMapRepository.findAllByCarIdAndDeletedAtIsNullOrderByCreatedAtDesc(carId)
                .stream()
                .map(SlamMapResponse.MapListResponse::from)
                .collect(Collectors.toList());
    }

    public SlamMapResponse.MapDetailResponse getLatestMap(Long carId, Long memberId) {
        getOwnedCar(carId, memberId);

        SlamMap map = slamMapRepository.findFirstByCarIdAndDeletedAtIsNullOrderByCreatedAtDesc(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAP_NOT_FOUND));

        return SlamMapResponse.MapDetailResponse.from(map);
    }

    public SlamMapResponse.MapDetailResponse getMapDetail(Long carId, Long memberId, Long mapId) {
        getOwnedCar(carId, memberId);

        SlamMap map = slamMapRepository.findByIdAndCarIdAndDeletedAtIsNull(mapId, carId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAP_NOT_FOUND));

        return SlamMapResponse.MapDetailResponse.from(map);
    }

    @Transactional
    public SlamMapResponse.MapDetailResponse updateMap(Long carId, Long memberId, Long mapId,
                                                       SlamMapRequest.UpdateRequest request) {
        getOwnedCar(carId, memberId);

        SlamMap map = slamMapRepository.findByIdAndCarIdAndDeletedAtIsNull(mapId, carId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAP_NOT_FOUND));

        map.updateInfo(request.name(), null);

        return SlamMapResponse.MapDetailResponse.from(map);
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

    private Car getOwnedCar(Long carId, Long memberId) {
        Car car = carRepository.findById(carId)
                .orElseThrow(() -> new CustomException(ErrorCode.CAR_NOT_FOUND));

        if (car.getOwner() == null || !car.getOwner().getId().equals(memberId)) {
            throw new CustomException(ErrorCode.UNAUTHORIZED_CAR_ACCESS);
        }

        return car;
    }
}