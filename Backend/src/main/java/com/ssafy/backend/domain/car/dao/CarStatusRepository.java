package com.ssafy.backend.domain.car.dao;

import com.ssafy.backend.domain.car.domain.CarStatus;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CarStatusRepository extends JpaRepository<CarStatus, Long> {}
