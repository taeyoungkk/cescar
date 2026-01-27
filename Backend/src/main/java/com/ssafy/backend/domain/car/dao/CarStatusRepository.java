package com.ssafy.backend.domain.car.dao;

import com.ssafy.backend.domain.car.domain.CarStatus;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 차량 상태(CarStatus) 리포지토리
 * - JPA 기본 메서드만 사용 (추가 메서드 불필요)
 * - carId를 PK로 사용하여 조회/저장
 */
public interface CarStatusRepository extends JpaRepository<CarStatus, Long> {}
