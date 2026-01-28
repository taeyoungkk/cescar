package com.ssafy.backend.domain.history.dao;

import com.ssafy.backend.domain.history.domain.Detection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DetectionRepository extends JpaRepository<Detection, Long> {

        // 특정 운행 기록(CarLog)에 속한 감지 내역 조회
        Page<Detection> findByCarLogId(Long carLogId, Pageable pageable);

        // 통계: 특정 로그의 라벨별 감지 횟수
        @org.springframework.data.jpa.repository.Query("SELECT new com.ssafy.backend.domain.history.dto.DetectionStatisticsResponse(d.label, COUNT(d)) "
                        +
                        "FROM Detection d WHERE d.carLog.id = :logId GROUP BY d.label")
        java.util.List<com.ssafy.backend.domain.history.dto.DetectionStatisticsResponse> countByLabel(Long logId);

        // 검색: 기간 및 라벨 필터링 (동적 쿼리 대신 간단한 JPQL 사용 - null 처리는 서비스에서 안하므로 모든 조건 필수)
        // TODO: QueryDSL 도입 시 동적 쿼리로 개선 권장
        @org.springframework.data.jpa.repository.Query("SELECT d FROM Detection d " +
                        "JOIN d.carLog cl JOIN cl.car c " +
                        "WHERE c.owner.id = :memberId " +
                        "AND d.createdAt BETWEEN :startDate AND :endDate " +
                        "AND (d.label = COALESCE(:label, d.label))")
        org.springframework.data.domain.Page<Detection> searchDetections(
                        @org.springframework.data.repository.query.Param("startDate") java.time.LocalDateTime startDate,
                        @org.springframework.data.repository.query.Param("endDate") java.time.LocalDateTime endDate,
                        @org.springframework.data.repository.query.Param("label") String label,
                        @org.springframework.data.repository.query.Param("memberId") Long memberId,
                        org.springframework.data.domain.Pageable pageable);
}