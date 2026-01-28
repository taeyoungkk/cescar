package com.ssafy.backend.domain.car.dao;

import com.ssafy.backend.domain.car.domain.Car;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CarRepository extends JpaRepository<Car, Long> {

    // claimCode로 차량 조회
    Optional<Car> findByClaimCode(String claimCode);

    // 특정 소유자의 차량 목록 조회
    @Query("SELECT c FROM Car c WHERE c.owner.id = :ownerId")
    List<Car> findAllByOwnerId(@Param("ownerId") Long ownerId);

    // deviceId로 차량 조회 (Jetson 인증용)
    Optional<Car> findByDeviceId(String deviceId);

    // 소유자가 있는지 확인
    @Query("SELECT CASE WHEN COUNT(c) > 0 THEN true ELSE false END FROM Car c WHERE c.id = :carId AND c.owner IS NOT NULL")
    boolean existsByIdAndOwnerIsNotNull(@Param("carId") Long carId);
}