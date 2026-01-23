package com.ssafy.backend.domain.car.application;

import com.ssafy.backend.domain.car.dao.CarRepository;
import com.ssafy.backend.domain.car.dao.CarStatusRepository;
import com.ssafy.backend.domain.car.domain.Car;
import com.ssafy.backend.domain.car.domain.CarStatus;
import com.ssafy.backend.domain.car.dto.CarRequest;
import com.ssafy.backend.domain.car.dto.CarResponse;
import com.ssafy.backend.domain.member.domain.Member;
import com.ssafy.backend.domain.member.dao.MemberRepository;
import com.ssafy.backend.global.exception.CustomException;
import com.ssafy.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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

        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.MEMBER_NOT_FOUND));

        car.registerOwner(member);

        // 닉네임 설정 (선택 사항)
        if (request.nickname() != null && !request.nickname().isBlank()) {
            car.updateNickname(request.nickname());
        }

        CarStatus status = carStatusRepository.findById(car.getId())
                .orElseGet(() -> {
                    CarStatus newStatus = CarStatus.create(car);
                    return carStatusRepository.save(newStatus);
                });

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
    public CarResponse.StatusResponse getCarStatus(Long carId) {
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
}
