package com.ssafy.backend.domain.car.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.ssafy.backend.domain.member.domain.Member;
import com.ssafy.backend.domain.map.domain.SlamMap;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Entity
@Table(name = "cars")
public class Car {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", nullable = false, unique = true, length = 64)
    private String deviceId;

    @Column(name = "nickname", length = 50)
    private String nickname;

    // 소유자 (nullable = true -> 등록 전엔 주인 없을 수 있음)
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private Member owner;

    // 현재 선택된 지도 (Map 엔티티와 연결)
    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_map_id")
    private SlamMap currentMap;

    @Column(name = "claim_code", nullable = false, unique = true, length = 32)
    private String claimCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private Car(String deviceId, String claimCode) {
        this.deviceId = deviceId;
        this.claimCode = claimCode;
    }

    public static Car create(String deviceId, String claimCode) {
        return Car.builder()
                .deviceId(deviceId)
                .claimCode(claimCode)
                .build();
    }


    // 소유자 등록 메서드
    public void registerOwner(Member member) {
        if (this.owner != null) {
            throw new IllegalStateException("이미 등록된 차량입니다.");
        }
        this.owner = member;
    }


    // ������ ��� ���� �޼���
    public void releaseOwner(Member member) {
        if (member == null || this.owner == null || !Objects.equals(this.owner.getId(), member.getId())) {
            throw new IllegalStateException("현재 오너만 해제할 수 있습니다.");
        }
        this.owner = null;
        this.currentMap = null;
    }


    // �г��� ���� �޼���
    public void updateNickname(String nickname) {
        this.nickname = nickname;
    }


    // ���� ���� ���� �޼���
    public void updateCurrentMap(SlamMap map) {
        if (map != null && map.getCar() != null && !Objects.equals(map.getCar().getId(), this.id)) {
            throw new IllegalArgumentException("해당 차량의 지도가 아닙니다.");
        }
        this.currentMap = map;
    }

    // 양방향 매핑 추가
    // orphanRemoval: 리스트에서 제거하면 DB에서도 삭제됨

    @JsonIgnore
    @OneToMany(mappedBy = "car", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SlamMap> maps = new ArrayList<>();

    // 편의 메서드: 지도 추가
    public void addMap(SlamMap map) {
        this.maps.add(map);
    }

    // 편의 메서드: 지도 제거
    public void removeMap(SlamMap map) {
        this.maps.remove(map);
        if (this.currentMap != null && Objects.equals(this.currentMap.getId(), map.getId())) {
            this.currentMap = null;
        }
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}