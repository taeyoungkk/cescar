package com.ssafy.backend.domain.history.dao;

import com.ssafy.backend.domain.history.domain.CarLog;
import com.ssafy.backend.domain.history.domain.LogStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CarLogRepository extends JpaRepository<CarLog, Long> {

    org.springframework.data.domain.Page<CarLog> findByCarId(Long carId,
            org.springframework.data.domain.Pageable pageable);

    Optional<CarLog> findFirstByCarIdAndStatusOrderByStartAtDesc(Long carId, LogStatus status);
}
