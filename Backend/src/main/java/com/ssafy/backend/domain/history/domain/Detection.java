package com.ssafy.backend.domain.history.domain;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "detections")
public class Detection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // 어떤 운행 기록에서 발견된 건지 연결
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "log_id", nullable = false)
    private CarLog carLog;

    @Column(nullable = false, length = 50)
    private String label; // 예: "cockroach", "fire"

    @Column(nullable = false)
    private float confidence; // 확신도 (0.0 ~ 1.0)

    // CarStatus와 통일성을 위해 BigDecimal 사용 (정밀도 유지)
    @Column(precision = 10, scale = 4)
    private BigDecimal x;

    @Column(precision = 10, scale = 4)
    private BigDecimal y;

    @Column(name = "image_url")
    private String imageUrl; // 탐지된 순간의 스냅샷

    @Column(name = "video_url")
    private String videoUrl; // 탐지 영상 (짧은 클립)

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private Detection(CarLog carLog, String label, float confidence, BigDecimal x, BigDecimal y, String imageUrl,
            String videoUrl) {
        this.carLog = carLog;
        this.label = label;
        this.confidence = confidence;
        this.x = x;
        this.y = y;
        this.imageUrl = imageUrl;
        this.videoUrl = videoUrl;
    }

    // 팩토리 메서드
    public static Detection create(CarLog carLog, String label, float confidence, BigDecimal x, BigDecimal y,
            String imageUrl, String videoUrl) {
        return Detection.builder()
                .carLog(carLog)
                .label(label)
                .confidence(confidence)
                .x(x)
                .y(y)
                .imageUrl(imageUrl)
                .videoUrl(videoUrl)
                .build();
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
