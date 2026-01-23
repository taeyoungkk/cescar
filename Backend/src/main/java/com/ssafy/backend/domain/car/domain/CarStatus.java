package com.ssafy.backend.domain.car.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "car_status")
public class CarStatus {

    @Id
    private Long carId; // PK이자 FK

    @OneToOne(fetch = FetchType.LAZY)
    @MapsId // Car의 PK를 내 PK로 같이 씀 (1:1 식별관계)
    @JoinColumn(name = "car_id")
    private Car car;

    @Column(precision = 10, scale = 4)
    private BigDecimal x;

    @Column(precision = 10, scale = 4)
    private BigDecimal y;

    @Column(nullable = false)
    private Float heading;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CarMode mode;

    @Column(name = "is_online", nullable = false)
    private boolean isOnline;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private CarStatus(Car car, BigDecimal x, BigDecimal y, Float heading, CarMode mode, boolean isOnline) {
        this.car = car;
        this.x = x;
        this.y = y;
        this.heading = heading;
        this.mode = mode;
        this.isOnline = isOnline;
    }

    // 초기 생성 팩토리 메서드
    // 차량 등록 시점에 CarService에서 호출
    public static CarStatus create(Car car) {
        return CarStatus.builder()
                .car(car)
                .x(BigDecimal.ZERO)  // 초기 좌표 0
                .y(BigDecimal.ZERO)  // 초기 좌표 0
                .heading(0.0f)       // 초기 헤딩 0
                .mode(CarMode.STOP)  // 초기 정지
                .isOnline(false)     // 초기 오프라인
                .build();
    }

    // 상태 전체 업데이트 (MQTT 등 센서 데이터 수신용)
    public void updateStatus(BigDecimal x, BigDecimal y, Float heading, CarMode mode, boolean isOnline) {
        this.x = x;
        this.y = y;
        this.heading = heading;
        this.mode = mode;
        this.isOnline = isOnline;
        // PreUpdate가 있지만, 명시적으로 비즈니스 로직 시점에 갱신해도 됨
        this.updatedAt = LocalDateTime.now();
    }

    // 특정 모드만 변경 (예: 앱에서 원격 제어 시)
    public void changeMode(CarMode mode) {
        this.mode = mode;
        this.updatedAt = LocalDateTime.now();
    }

    @PrePersist
    protected void onCreate() {
        this.updatedAt = LocalDateTime.now();
        // 혹시 모를 null 방지용 안전장치
        if (this.heading == null) this.heading = 0.0f;
        if (this.mode == null) this.mode = CarMode.STOP;
        if (this.x == null) this.x = BigDecimal.ZERO;
        if (this.y == null) this.y = BigDecimal.ZERO;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}