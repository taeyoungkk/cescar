package com.ssafy.backend.domain.history.dao;

import com.ssafy.backend.domain.history.domain.CarLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CarLogRepository extends JpaRepository<CarLog, Long> {

    org.springframework.data.domain.Page<CarLog> findByCarId(Long carId,
            org.springframework.data.domain.Pageable pageable);
}
