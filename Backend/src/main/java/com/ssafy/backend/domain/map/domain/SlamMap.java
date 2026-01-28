package com.ssafy.backend.domain.map.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.ssafy.backend.domain.car.domain.Car;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "maps")
public class SlamMap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "car_id", nullable = false)
    private Car car;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(nullable = false)
    private float resolution;

    @Column(name = "origin_x", nullable = false)
    private float originX;

    @Column(name = "origin_y", nullable = false)
    private float originY;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private SlamMap(Car car, String name, String imageUrl, int width, int height, float resolution, float originX,
            float originY) {
        this.car = car;
        this.name = name;
        this.imageUrl = imageUrl;
        this.width = width;
        this.height = height;
        this.resolution = resolution;
        this.originX = originX;
        this.originY = originY;
    }

    // 팩토리 메서드
    public static SlamMap create(Car car, String name, String imageUrl, int width, int height, float resolution,
            float originX, float originY) {
        return SlamMap.builder()
                .car(car)
                .name(name)
                .imageUrl(imageUrl)
                .width(width)
                .height(height)
                .resolution(resolution)
                .originX(originX)
                .originY(originY)
                .build();
    }

    // 정보 수정 메서드 (이름 변경 등)
    public void updateInfo(String name, String imageUrl) {
        if (name != null && !name.isBlank()) {
            this.name = name;
        }
        if (imageUrl != null && !imageUrl.isBlank()) {
            this.imageUrl = imageUrl;
        }
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}