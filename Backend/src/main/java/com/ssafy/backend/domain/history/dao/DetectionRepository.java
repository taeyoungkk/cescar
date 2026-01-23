package com.ssafy.backend.domain.history.dao;

import com.ssafy.backend.domain.history.domain.Detection;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DetectionRepository extends JpaRepository<Detection, Long> {

}