package com.ssafy.backend.domain.notification.dao;

import com.ssafy.backend.domain.notification.domain.NotificationToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationTokenRepository extends JpaRepository<NotificationToken, Long> {
    Optional<NotificationToken> findByToken(String token);
    List<NotificationToken> findAllByMemberId(Long memberId);
    int deleteByMemberIdAndToken(Long memberId, String token);
    int deleteByToken(String token);
}
