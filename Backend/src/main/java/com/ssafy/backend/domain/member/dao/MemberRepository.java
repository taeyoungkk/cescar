package com.ssafy.backend.domain.member.dao;

import com.ssafy.backend.domain.member.domain.Member;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, Long> {
    // 기본 CRUD는 JpaRepository가 알아서 제공

}