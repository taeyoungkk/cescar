package com.ssafy.backend.domain.car.dao;

import com.ssafy.backend.domain.car.domain.Car;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CarRepository extends JpaRepository<Car, Long> {

}