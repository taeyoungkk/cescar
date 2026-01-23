package com.ssafy.backend.domain.history.dao;

import com.ssafy.backend.domain.history.domain.CarLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CarLogRepository extends JpaRepository<CarLog, Long> {

}
