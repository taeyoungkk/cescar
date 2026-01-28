package com.ssafy.backend.domain.history.application;

import com.ssafy.backend.domain.history.dao.CarLogRepository;
import com.ssafy.backend.domain.history.dto.CarLogListItemResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class CarLogService {

    private final CarLogRepository carLogRepository;

    /**
     * 특정 차량의 운행 기록 목록 조회
     */
    public Page<CarLogListItemResponse> searchCarLogs(Long carId, Pageable pageable) {
        return carLogRepository.findByCarId(carId, pageable)
                .map(CarLogListItemResponse::from);
    }
}
