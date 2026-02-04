package com.ssafy.backend.domain.history.domain;

import com.ssafy.backend.domain.car.domain.Car;
import com.ssafy.backend.domain.map.domain.SlamMap;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "car_logs")
public class CarLog {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "car_id", nullable = false)
    private Car car;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "map_id", nullable = false)
    private SlamMap map;

    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LogStatus status;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "detection_count", nullable = false)
    private int detectionCount;

    @Builder
    private CarLog(Car car, SlamMap map, LocalDateTime startAt, LogStatus status, Long ownerId) {
        this.car = car;
        this.map = map;
        this.startAt = startAt;
        this.status = status;
        this.ownerId = ownerId;
        this.detectionCount = 0;
    }

    // 팩토리 메서드
    public static CarLog create(Car car, SlamMap map, Long ownerId) {
        return CarLog.builder()
                .car(car)
                .map(map)
                .startAt(LocalDateTime.now()) // 시작 시간 자동 설정
                .status(LogStatus.RUNNING)    // 초기 상태는 '주행 중'
                .ownerId(ownerId)
                .build();
    }

    // 운행 종료 (성공, 정지, 에러 등 상태와 함께 종료 시간 기록)
    public void finish(LogStatus status) {
        this.status = status;
        this.endAt = LocalDateTime.now();
    }

    // 탐지된 객체 수 증가
    public void increaseDetectionCount() {
        this.detectionCount++;
    }
}

