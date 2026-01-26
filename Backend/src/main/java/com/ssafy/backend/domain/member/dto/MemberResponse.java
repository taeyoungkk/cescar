package com.ssafy.backend.domain.member.dto;

import com.ssafy.backend.domain.member.domain.Member;

/**
 * 회원 관련 응답 DTO
 */
public class MemberResponse {

    /**
     * 회원 기본 정보 응답
     */
    public record MemberInfoResponse(
            Long id,
            String email,
            String name,
            String nickname) {
        public static MemberInfoResponse from(Member member) {
            return new MemberInfoResponse(
                    member.getId(),
                    member.getEmail(),
                    member.getName(),
                    member.getNickname());
        }
    }

    /**
     * 로그인 결과 응답
     */
    public record LoginResponse(
            String accessToken,
            MemberInfoResponse member) {
        public static LoginResponse of(String token, Member member) {
            return new LoginResponse(token, MemberInfoResponse.from(member));
        }
    }
}
