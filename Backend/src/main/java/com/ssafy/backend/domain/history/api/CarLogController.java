package com.ssafy.backend.domain.history.api;

import com.ssafy.backend.domain.history.application.CarLogService;
import com.ssafy.backend.domain.history.dto.CarLogListItemResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "History", description = "운행 감지 이력 API")
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CarLogController {

    private final CarLogService carLogService;

    @Operation(summary = "차량 운행 기록 목록 조회", description = "특정 차량의 운행 기록을 페이징하여 조회합니다.")
    @GetMapping("/cars/{carId}/logs")
    public ResponseEntity<Page<CarLogListItemResponse>> getCarLogs(
            @Parameter(description = "차량 ID", required = true) @PathVariable Long carId,
            @PageableDefault(size = 20, sort = "startAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(carLogService.searchCarLogs(carId, pageable));
    }
}
