package com.ssafy.backend.domain.map.dao;

import com.ssafy.backend.domain.map.domain.SlamMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SlamMapRepository extends JpaRepository<SlamMap, Long> {

    List<SlamMap> findAllByCarIdAndOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long carId, Long ownerId);

    Optional<SlamMap> findFirstByCarIdAndOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long carId, Long ownerId);

    Optional<SlamMap> findByIdAndCarIdAndOwnerIdAndDeletedAtIsNull(Long id, Long carId, Long ownerId);
}
