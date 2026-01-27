package com.ssafy.backend.domain.history.dao;

import com.ssafy.backend.domain.history.domain.Detection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DetectionRepository extends JpaRepository<Detection, Long> {

    // 특정 운행 기록(CarLog)에 속한 감지 내역 조회
    Page<Detection> findByCarLogId(Long carLogId, Pageable pageable);
}