package com.ssafy.backend.domain.map.dao;

import com.ssafy.backend.domain.map.domain.SlamMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SlamMapRepository extends JpaRepository<SlamMap, Long> {

    List<SlamMap> findAllByCarIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long carId);

    Optional<SlamMap> findFirstByCarIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long carId);

    Optional<SlamMap> findByIdAndCarIdAndDeletedAtIsNull(Long id, Long carId);
}
