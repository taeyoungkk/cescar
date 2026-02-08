package com.ssafy.backend.domain.car.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

    @JsonIgnore
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

    // @Column(name = "is_online", nullable = false) -> 삭제됨 (Heartbeat 방식)
    // private boolean isOnline;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Builder
    private CarStatus(Car car, BigDecimal x, BigDecimal y, Float heading, CarMode mode) {
        this.car = car;
        this.x = x;
        this.y = y;
        this.heading = heading;
        this.mode = mode;
        // this.isOnline = isOnline; -> 삭제
    }

    // 초기 생성 팩토리 메서드
    public static CarStatus create(Car car) {
        return CarStatus.builder()
                .car(car)
                .x(BigDecimal.ZERO)
                .y(BigDecimal.ZERO)
                .heading(0.0f)
                .mode(CarMode.STOP)
                .build();
    }

    // 상태 전체 업데이트
    public void updateStatus(BigDecimal x, BigDecimal y, Float heading, CarMode mode) {
        this.x = x;
        this.y = y;
        this.heading = heading;
        this.mode = mode;
        this.updatedAt = LocalDateTime.now(); // 갱신 시간 업데이트
    }

    // 특정 모드만 변경
    public void changeMode(CarMode mode) {
        this.mode = mode;
        this.updatedAt = LocalDateTime.now();
    }

    // Heartbeat 로직: 10초 이내 통신 기록이 있으면 온라인으로 간주
    // Lombok @Getter가 아닌 수동 Getter 사용 (메서드명 isOnline 준수)
    public boolean isOnline() {
        if (this.updatedAt == null)
            return false;
        return this.updatedAt.isAfter(LocalDateTime.now().minusSeconds(11));
    }

    @PrePersist
    protected void onCreate() {
        this.updatedAt = LocalDateTime.now();
        if (this.heading == null)
            this.heading = 0.0f;
        if (this.mode == null)
            this.mode = CarMode.STOP;
        if (this.x == null)
            this.x = BigDecimal.ZERO;
        if (this.y == null)
            this.y = BigDecimal.ZERO;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}